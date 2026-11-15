import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { scopeProject } from "@/lib/ai";
import { buildQuoteResult, computePricing } from "@/lib/quote";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_RATES, FREE_MONTHLY_LIMIT, type Profile, type Rates } from "@/lib/types";

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

const QUESTIONS = [
  "What do you need edited?",
  "How many videos/thumbnails, and roughly how long is the footage?",
  "What style/references do you want, and what's your deadline?",
  "Your name + email or X/Discord handle",
];

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

  // ---- Resolve the editor's rates -------------------------------------------------
  let profile: Profile | null = null;
  let rates: Rates = DEFAULT_RATES;
  let currency = "USD";
  const supabase = demo ? null : await createClient();

  if (!demo && supabase) {
    if (!handle) return NextResponse.json({ error: "Missing handle." }, { status: 400 });
    const { data } = await supabase.from("profiles").select("*").eq("handle", handle).maybeSingle();
    if (!data) return NextResponse.json({ error: "This link doesn't exist." }, { status: 404 });
    profile = data as Profile;
    rates = { ...DEFAULT_RATES, ...(profile.rates ?? {}) };
    currency = profile.currency || "USD";
  }

  // ---- AI scopes the project; code does ALL the math ------------------------------
  const { scope } = await scopeProject(answers, rates, {
    editorName: profile?.display_name || profile?.handle || "the editor",
    currency,
    customNotes: profile?.custom_notes ?? null,
  });

  const pricing = computePricing(
    { items: scope.items, is_rush: scope.is_rush, complexity: scope.complexity },
    rates
  );
  const days = Math.min(60, Math.max(1, Math.round(scope.turnaround_days) || 5));
  const quote = buildQuoteResult(
    pricing,
    {
      project_summary: scope.project_summary,
      deliverables: scope.deliverables.slice(0, 8),
      timeline: scope.timeline,
      turnaround_days: days,
      revision_terms: scope.revision_terms,
    },
    { is_rush: scope.is_rush, currency, custom_notes: profile?.custom_notes ?? null }
  );

  // ---- Save the lead (real links only) --------------------------------------------
  let saved = false;
  if (profile && supabase) {
    let underLimit = true;
    if (profile.plan !== "pro") {
      const { data: count } = await supabase.rpc("quotes_this_month", { p_editor: profile.id });
      underLimit = (count ?? 0) < FREE_MONTHLY_LIMIT;
    }
    if (underLimit) {
      const transcript = (questions?.length === 4 ? questions : QUESTIONS).map((question, i) => ({
        question,
        answer: [answers.need, answers.volume, answers.style, `${answers.name} — ${answers.contact}`][i],
      }));
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
        chat_transcript: transcript,
      });
      if (error) console.error("[generate-quote] insert failed:", error.message);
      saved = !error;
    }
  }

  return NextResponse.json({ quote, saved });
}
