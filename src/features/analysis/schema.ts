import { z } from 'zod';

import { KICK_TYPES } from '@/constants/kicks';

import type { CoachingResult } from './types';

const subScore = z.number().int().min(0).max(25);

export const DrillSchema = z.object({
  name: z.string().min(2).max(60),
  how: z.string().min(10).max(320),
  reps: z.string().min(1).max(30),
});

export const SubScoresSchema = z.object({
  approach: subScore,
  plant_foot: subScore,
  contact: subScore,
  follow_through: subScore,
});

/** Strict contract for the coaching model. Mirrors §5 of the product spec. */
export const CoachingResultSchema = z
  .object({
    kick_type: z.enum(KICK_TYPES),
    kick_rating: z.number().int().min(0).max(100).nullable(),
    sub_scores: SubScoresSchema.nullable(),
    one_fix: z.string().max(400),
    why_it_matters: z.string().max(300),
    drills: z.array(DrillSchema).min(0).max(3),
    confidence: z.number().min(0).max(1),
    retry_reason: z.string().max(300).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.kick_rating === null) {
      if (!v.retry_reason) ctx.addIssue({ code: 'custom', message: 'retry_reason required when kick_rating is null', path: ['retry_reason'] });
      return;
    }
    if (!v.sub_scores) {
      ctx.addIssue({ code: 'custom', message: 'sub_scores required when rated', path: ['sub_scores'] });
      return;
    }
    const sum = v.sub_scores.approach + v.sub_scores.plant_foot + v.sub_scores.contact + v.sub_scores.follow_through;
    if (Math.abs(sum - v.kick_rating) > 2) {
      ctx.addIssue({ code: 'custom', message: `sub_scores sum ${sum} must equal kick_rating ${v.kick_rating}`, path: ['kick_rating'] });
    }
    if (v.drills.length !== 3) ctx.addIssue({ code: 'custom', message: 'exactly 3 drills required when rated', path: ['drills'] });
    if (v.one_fix.trim().length < 10) ctx.addIssue({ code: 'custom', message: 'one_fix required when rated', path: ['one_fix'] });
    const sentences = v.one_fix.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    if (sentences.length > 2) ctx.addIssue({ code: 'custom', message: 'one_fix must be at most 2 sentences', path: ['one_fix'] });
  });

/** Gemini `responseSchema` (OpenAPI subset). Keeps the model honest before Zod even runs. */
export const geminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    kick_type: { type: 'STRING', enum: [...KICK_TYPES] },
    kick_rating: { type: 'INTEGER', nullable: true },
    sub_scores: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        approach: { type: 'INTEGER' },
        plant_foot: { type: 'INTEGER' },
        contact: { type: 'INTEGER' },
        follow_through: { type: 'INTEGER' },
      },
      required: ['approach', 'plant_foot', 'contact', 'follow_through'],
    },
    one_fix: { type: 'STRING' },
    why_it_matters: { type: 'STRING' },
    drills: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, how: { type: 'STRING' }, reps: { type: 'STRING' } },
        required: ['name', 'how', 'reps'],
      },
    },
    confidence: { type: 'NUMBER' },
    retry_reason: { type: 'STRING', nullable: true },
  },
  required: ['kick_type', 'kick_rating', 'sub_scores', 'one_fix', 'why_it_matters', 'drills', 'confidence', 'retry_reason'],
} as const;

export type ParseOutcome = { ok: true; value: CoachingResult } | { ok: false; error: string };

/** Extract JSON from a model reply (tolerates code fences) and validate it. */
export function parseCoachingResult(raw: string): ParseOutcome {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return { ok: false, error: 'No JSON object in response' };
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  // Normalise a common model slip: sub-scores that drift by ±2 from the total.
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    const ss = d.sub_scores as Record<string, number> | null | undefined;
    if (ss && typeof d.kick_rating === 'number') {
      const sum = (ss.approach ?? 0) + (ss.plant_foot ?? 0) + (ss.contact ?? 0) + (ss.follow_through ?? 0);
      if (Math.abs(sum - d.kick_rating) <= 2) d.kick_rating = sum;
    }
  }
  const parsed = CoachingResultSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `${first?.path.join('.') ?? ''}: ${first?.message ?? 'invalid'}` };
  }
  return { ok: true, value: parsed.data as CoachingResult };
}
