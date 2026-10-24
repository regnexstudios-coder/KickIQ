import type { KickType } from '@/constants/kicks';
import type { KickMetrics } from '@/features/pose/types';

export const SYSTEM_PROMPT =
  'You are an elite youth soccer technique coach. Score the kick using the rubric. Be specific, encouraging, and brief. Never give medical advice. Output JSON only.';

export interface PromptContext {
  kickType: KickType;
  metrics: KickMetrics | null;
  heightCm: number | null;
  level: string | null;
  weakness: string | null;
  source: 'camera' | 'import';
  frameOrder: string[];
}

const KICK_GUIDE: Record<KickType, string> = {
  driven:
    'Driven shot: laces contact through the centre of the ball, plant foot level with the ball ~15–25 cm beside it, knee over the ball, head down, low full follow-through toward the target.',
  curler:
    'Curler / free kick: inside-of-foot contact on the outer lower half of the ball, slightly angled approach (~30–45°), plant foot 20–30 cm beside and level with the ball pointing at target, follow-through wraps across the body.',
  knuckleball:
    'Knuckleball: straight approach, flat laces contact dead centre, stiff ankle, very short abrupt follow-through, body stays tall and square.',
  chip:
    'Chip: toes stab under the ball with a steep downward swing, minimal follow-through, plant foot slightly behind the ball, body leans back a touch.',
};

export function buildUserPrompt(ctx: PromptContext): string {
  const metricsBlock = ctx.metrics
    ? `ON-DEVICE MEASUREMENTS (estimated from pose tracking; distances derived from body scale):\n${JSON.stringify(ctx.metrics, null, 2)}`
    : 'ON-DEVICE MEASUREMENTS: not available (clip imported). Estimate technique from the key frames and lower confidence accordingly.';

  return [
    `KICK TYPE: ${ctx.kickType}`,
    `TECHNIQUE GUIDE: ${KICK_GUIDE[ctx.kickType]}`,
    `PLAYER: ${ctx.level ?? 'unknown level'}, self-reported weakness: ${ctx.weakness ?? 'unknown'}, height ${ctx.heightCm ?? 'unknown'} cm, age 13–18.`,
    metricsBlock,
    `KEY FRAMES (in order): ${ctx.frameOrder.join(', ')}. Each image is one phase of the same kick.`,
    '',
    'RUBRIC: score each of approach, plant_foot, contact, follow_through from 0 to 25. kick_rating MUST equal their sum.',
    'Scoring bands: 22–25 pro-level mechanics; 17–21 solid with one visible flaw; 11–16 clear technical issue; 0–10 fundamental problem.',
    'ONE_FIX: the single change that would raise the score most. Max 2 sentences, specific and measurable (cm, degrees, body part, cue).',
    'DRILLS: exactly 3, each with a name, a 30-second "how" description a teenager can follow alone, and reps like "3 x 10".',
    'If the clip is unusable (no full body, no ball strike visible, multiple people, wrong sport), set kick_rating and sub_scores to null and write a short retry_reason telling the player how to re-film.',
    'Set confidence between 0 and 1 for how clearly you could judge the kick. Tone: encouraging, direct, no medical or injury advice.',
    'Respond with JSON only matching the provided schema.',
  ].join('\n');
}
