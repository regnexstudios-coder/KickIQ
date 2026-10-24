// Supabase Edge Function: proxies kick analysis to Gemini so the API key never ships in the app.
// Deploy: supabase functions deploy analyze-kick --no-verify-jwt=false
// Secrets: supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.5-flash
import { createClient } from 'npm:@supabase/supabase-js@2';

const SYSTEM_PROMPT =
  'You are an elite youth soccer technique coach. Score the kick using the rubric. Be specific, encouraging, and brief. Never give medical advice. Output JSON only.';

const KICK_TYPES = ['driven', 'curler', 'knuckleball', 'chip'];

const responseSchema = {
  type: 'OBJECT',
  properties: {
    kick_type: { type: 'STRING', enum: KICK_TYPES },
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
};

const KICK_GUIDE: Record<string, string> = {
  driven: 'Driven shot: laces contact through the centre of the ball, plant foot level with the ball ~15–25 cm beside it, knee over the ball, head down, low full follow-through toward the target.',
  curler: 'Curler / free kick: inside-of-foot contact on the outer lower half of the ball, slightly angled approach (~30–45°), plant foot 20–30 cm beside and level with the ball pointing at target, follow-through wraps across the body.',
  knuckleball: 'Knuckleball: straight approach, flat laces contact dead centre, stiff ankle, very short abrupt follow-through, body stays tall and square.',
  chip: 'Chip: toes stab under the ball with a steep downward swing, minimal follow-through, plant foot slightly behind the ball, body leans back a touch.',
};

interface Req {
  kick_type: string;
  metrics: unknown | null;
  height_cm: number | null;
  level: string | null;
  weakness: string | null;
  source: 'camera' | 'import';
  frame_order: string[];
  frames: string[];
}

function buildPrompt(r: Req): string {
  const metricsBlock = r.metrics
    ? `ON-DEVICE MEASUREMENTS (estimated from pose tracking; distances derived from body scale):\n${JSON.stringify(r.metrics, null, 2)}`
    : 'ON-DEVICE MEASUREMENTS: not available (clip imported). Estimate technique from the key frames and lower confidence accordingly.';
  return [
    `KICK TYPE: ${r.kick_type}`,
    `TECHNIQUE GUIDE: ${KICK_GUIDE[r.kick_type] ?? ''}`,
    `PLAYER: ${r.level ?? 'unknown level'}, self-reported weakness: ${r.weakness ?? 'unknown'}, height ${r.height_cm ?? 'unknown'} cm, age 13–18.`,
    metricsBlock,
    `KEY FRAMES (in order): ${r.frame_order.join(', ')}. Each image is one phase of the same kick.`,
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

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  // Require a signed-in (anonymous is fine) Supabase user to stop drive-by usage of the Gemini quota.
  const authHeader = req.headers.get('Authorization') ?? '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors });

  let body: Req;
  try {
    body = (await req.json()) as Req;
  } catch {
    return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: cors });
  }
  if (!KICK_TYPES.includes(body.kick_type)) return new Response(JSON.stringify({ error: 'bad kick_type' }), { status: 400, headers: cors });
  if (!Array.isArray(body.frames) || body.frames.length > 6) return new Response(JSON.stringify({ error: 'bad frames' }), { status: 400, headers: cors });
  for (const f of body.frames) if (typeof f !== 'string' || f.length > 1_500_000) return new Response(JSON.stringify({ error: 'frame too large' }), { status: 413, headers: cors });

  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return new Response(JSON.stringify({ error: 'server not configured' }), { status: 500, headers: cors });

  const geminiBody = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildPrompt(body) },
          ...body.frames.map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } })),
        ],
      },
    ],
    generationConfig: { temperature: 0.35, maxOutputTokens: 1024, responseMimeType: 'application/json', responseSchema },
  };

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(geminiBody),
  });
  if (!res.ok) {
    const txt = await res.text();
    return new Response(JSON.stringify({ error: 'gemini', status: res.status, detail: txt.slice(0, 500) }), { status: 502, headers: cors });
  }
  const json = await res.json();
  const text: string =
    json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  return new Response(JSON.stringify({ text }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
