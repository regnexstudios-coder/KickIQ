import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { heuristicScope, scopeProject, type AIScope } from "@/lib/ai";
import { buildQuoteResult, computePricing } from "@/lib/quote";
import { hasSupabaseEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_RATES, FREE_MONTHLY_LIMIT, type Answers, type Profile, type QuoteResult, type Rates } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const text = (max: number) => z.string().trim().min(1).max(max);

const bodySchema = z.object({
  handle: z.string().trim().toLowerCase().max(40).optional(),
  demo: z.boolean().optional(),
  questions: z.array(z.string().trim().max(300)).max(4).optional(),
  answers: z.object({
    need: text(600),
    volume: text(400),
    style: text(600),
    name: text(80),
    contact: text(120),
  }),
});

const DEFAULT_QUESTIONS = [
  "What do you need edited?",
  "How many videos/thumbnails, and roughly how long is the footage?",
  "What style/references do you want, and what's your deadline?",
  "Your name + email or X/Discord handle",
];

/** All dollar amounts come from here: AI output is only ever *scope*, never price. */
function assemble(scope: AIScope, rates: Rates, currency: string, customNotes: string | null): QuoteResult {
  const pricing = computePricing({ items: scope.items, is_rush: scope.is_rush, complexity: scope.complexity }, rates);
  return buildQuoteResult(
    pricing,
    {
      project_summary: scope.project_summary,
      deliverables: scope.deliverables.slice(0, 8),
      timeline: scope.timeline,
      turnaround_days: Math.min(60, Math.max(1, Math.round(scope.turnaround_days) || 5)),
      revision_terms: scope.revision_terms,
    },
    { is_rush: scope.is_rush, currency, custom_notes: customNotes }
  );
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`quote:${ip}`)) {
    return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please answer every question." }, { status: 400 });
  }
  const { handle, demo, answers, questions } = parsed.data;

  let profile: Profile | null = null;
  let rates: Rates = DEFAULT_RATES;
  let currency = "USD";
  let degraded = false; // true when we had to fall back (no DB, lookup failure, AI failure)

  // ---- 1. Resolve the editor's exact rates ---------------------------------------
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  if (!demo) {
    if (!handle) return NextResponse.json({ error: "Missing handle." }, { status: 400 });
    if (hasSupabaseEnv()) {
      try {
        supabase = await createClient();
        const { data, error } = await supabase.from("profiles").select("*").eq("handle", handle).maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json({ error: "This link doesn't exist." }, { status: 404 });
        profile = data as Profile;
        rates = { ...DEFAULT_RATES, ...(profile.rates ?? {}) };
        currency = profile.currency || "USD";
      } catch (err) {
        console.error("[generate-quote] profile lookup failed:", err);
        supabase = null;
        degraded = true;
      }
    } else {
      degraded = true;
    }
  }

  // ---- 2. AI scopes the project; deterministic fallback if anything throws -------
  const customNotes = profile?.custom_notes ?? null;
  let scope: AIScope;
  try {
    const res = await scopeProject(answers as Answers, rates, {
      editorName: profile?.display_name || profile?.handle || "the editor",
      currency,
      customNotes,
    });
    scope = res.scope;
    if (!res.usedAI) degraded = true;
  } catch (err) {
    console.error("[generate-quote] scoping failed:", err);
    scope = heuristicScope(answers as Answers);
    degraded = true;
  }

  // ---- 3. Programmatic pricing (min budget + rush fee enforced in code) ----------
  let quote: QuoteResult;
  try {
    quote = assemble(scope, rates, currency, customNotes);
  } catch (err) {
    console.error("[generate-quote] pricing failed, using heuristic scope:", err);
    quote = assemble(heuristicScope(answers as Answers), rates, currency, customNotes);
    degraded = true;
  }

  // ---- 4. Save the lead (never blocks the client from seeing their quote) --------
  let saved = false;
  if (profile && supabase) {
    try {
      let underLimit = true;
      if (profile.plan !== "pro") {
        const { data: count } = await supabase.rpc("quotes_this_month", { p_editor: profile.id });
        underLimit = (count ?? 0) < FREE_MONTHLY_LIMIT;
      }
      if (underLimit) {
        const qs = questions?.length === 4 ? questions : DEFAULT_QUESTIONS;
        const replies = [answers.need, answers.volume, answers.style, `${answers.name} — ${answers.contact}`];
        const { error } = await supabase.from("quotes").insert({
          editor_id: profile.id,
          client_name: answers.name,
          client_contact: answers.contact,
          project_summary: quote.project_summary,
          service_type: quote.service_type,
          quantity: quote.quantity,
          is_rush: quote.is_rush,
          estimated_min: quote.estimated_min,
          estimated_max: quote.estimated_max,
          scope_breakdown: quote.scope_breakdown,
          chat_transcript: qs.map((question, i) => ({ question, answer: replies[i] })),
        });
        if (error) throw error;
        saved = true;
      }
    } catch (err) {
      console.error("[generate-quote] save failed:", err);
    }
  }

  return NextResponse.json({ quote, saved, degraded });
}
