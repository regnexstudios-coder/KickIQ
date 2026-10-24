import { config } from '@/lib/config';

import { getSupabase } from '@/features/auth/supabase';

import { buildUserPrompt, SYSTEM_PROMPT, type PromptContext } from './prompt';
import { geminiResponseSchema, parseCoachingResult } from './schema';
import type { CoachingResult } from './types';

export interface CoachRequest extends PromptContext {
  /** Base64 JPEG per key frame, same order as frameOrder. */
  framesBase64: string[];
}

export class CoachError extends Error {
  constructor(
    message: string,
    public readonly kind: 'not_configured' | 'network' | 'timeout' | 'invalid_json' | 'http',
  ) {
    super(message);
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new CoachError('timeout', 'timeout')), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Body sent to Gemini's generateContent. Shared with the Edge Function. */
export function buildGeminiBody(req: CoachRequest) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildUserPrompt(req) },
          ...req.framesBase64.map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } })),
        ],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: geminiResponseSchema,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
    ],
  };
}

export function extractGeminiText(json: unknown): string {
  const parts = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts;
  return parts?.map((p) => p.text ?? '').join('') ?? '';
}

/** Dev-only path: call Gemini directly with a public key. Production uses the Edge Function. */
async function callGeminiDirect(req: CoachRequest): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.gemini.apiKey! },
    body: JSON.stringify(buildGeminiBody(req)),
  });
  if (!res.ok) throw new CoachError(`Gemini HTTP ${res.status}`, 'http');
  return extractGeminiText(await res.json());
}

/** Production path: Supabase Edge Function holds the Gemini key; the app sends frames + metrics. */
async function callAnalyzeEndpoint(req: CoachRequest): Promise<string> {
  const sb = getSupabase();
  const token = sb ? (await sb.auth.getSession()).data.session?.access_token : undefined;
  const res = await fetch(config.gemini.analyzeEndpoint!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.supabase.anonKey ? { apikey: config.supabase.anonKey } : {}),
    },
    body: JSON.stringify({
      kick_type: req.kickType,
      metrics: req.metrics,
      height_cm: req.heightCm,
      level: req.level,
      weakness: req.weakness,
      source: req.source,
      frame_order: req.frameOrder,
      frames: req.framesBase64,
    }),
  });
  if (!res.ok) throw new CoachError(`Analyze endpoint HTTP ${res.status}`, 'http');
  const json = (await res.json()) as { text?: string; result?: unknown };
  return json.text ?? JSON.stringify(json.result ?? json);
}

export async function requestCoaching(req: CoachRequest): Promise<CoachingResult> {
  const useEndpoint = Boolean(config.gemini.analyzeEndpoint);
  if (!useEndpoint && !config.gemini.apiKey) throw new CoachError('No Gemini key or analyze endpoint', 'not_configured');

  let text: string;
  try {
    text = await withTimeout(useEndpoint ? callAnalyzeEndpoint(req) : callGeminiDirect(req), config.limits.analysisTimeoutMs);
  } catch (e) {
    if (e instanceof CoachError) throw e;
    throw new CoachError((e as Error).message, 'network');
  }

  const parsed = parseCoachingResult(text);
  if (parsed.ok) return parsed.value;

  // One repair attempt: ask the model to fix its own JSON against the schema error.
  const repair = { ...req, frameOrder: req.frameOrder, framesBase64: [] as string[] };
  const repairText = await withTimeout(
    useEndpoint ? callAnalyzeEndpoint(repair) : callGeminiDirect(repair),
    config.limits.analysisTimeoutMs,
  ).catch(() => '');
  const reparsed = parseCoachingResult(repairText);
  if (reparsed.ok) return reparsed.value;
  throw new CoachError(parsed.error, 'invalid_json');
}
