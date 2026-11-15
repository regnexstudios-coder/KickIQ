import type { QuoteResult, Rates, ScopeBreakdown, ServiceKey, ServiceType } from "./types";

export const SERVICE_LABEL: Record<ServiceKey, string> = {
  short_form: "Short-form video",
  long_form: "Long-form video",
  thumbnail: "Thumbnail",
};

export function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}

/** Round to the nearest 5 so ranges look intentional. */
const round5 = (n: number) => Math.round(n / 5) * 5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export interface PricingInput {
  items: { service: ServiceKey; quantity: number }[];
  is_rush: boolean;
  complexity: number;
}

/**
 * Deterministic pricing. The AI only *describes* the project (items, rush, complexity);
 * every dollar figure is computed here from the editor's exact rates:
 *   line  = unit_rate x quantity x complexity (0.8-1.5)
 *   range = subtotal x [0.9, 1.2] x (rush ? rush_multiplier : 1)
 *   floor = both ends of the range are raised to min_budget
 */
export function computePricing(input: PricingInput, rates: Rates) {
  const complexity = clamp(Number(input.complexity) || 1, 0.8, 1.5);

  const merged = new Map<ServiceKey, number>();
  for (const it of input.items) {
    const q = clamp(Math.round(Number(it.quantity) || 0), 0, 500);
    if (q > 0) merged.set(it.service, (merged.get(it.service) ?? 0) + q);
  }
  if (merged.size === 0) merged.set("short_form", 1);

  const items = [...merged.entries()].map(([service, quantity]) => {
    const unit_rate = Number(rates[service]) || 0;
    return { service, quantity, unit_rate, line_total: round5(unit_rate * quantity * complexity) };
  });

  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const rushMult = input.is_rush ? Math.max(1, Number(rates.rush_multiplier) || 1) : 1;
  const minBudget = Math.max(0, Number(rates.min_budget) || 0);

  const min = Math.max(round5(subtotal * 0.9 * rushMult), minBudget);
  const max = Math.max(round5(subtotal * 1.2 * rushMult), min);

  const service_type: ServiceType = items.length === 1 ? items[0].service : "bundle";
  const quantity = items.reduce((s, i) => s + i.quantity, 0);

  return { items, subtotal, estimated_min: min, estimated_max: max, service_type, quantity, complexity };
}

export function buildQuoteResult(
  pricing: ReturnType<typeof computePricing>,
  ai: {
    project_summary: string;
    deliverables: string[];
    timeline: string;
    turnaround_days: number;
    revision_terms: string;
  },
  opts: { is_rush: boolean; currency: string; custom_notes: string | null }
): QuoteResult {
  const scope_breakdown: ScopeBreakdown = {
    items: pricing.items,
    deliverables: ai.deliverables,
    timeline: ai.timeline,
    turnaround_days: ai.turnaround_days,
    revision_terms: ai.revision_terms,
    terms: opts.custom_notes ?? "",
    currency: opts.currency,
    complexity: pricing.complexity,
    subtotal: pricing.subtotal,
  };
  return {
    project_summary: ai.project_summary,
    service_type: pricing.service_type,
    quantity: pricing.quantity,
    is_rush: opts.is_rush,
    estimated_min: pricing.estimated_min,
    estimated_max: pricing.estimated_max,
    scope_breakdown,
  };
}

/** Plain-text proposal the editor can paste back to the client. */
export function quoteSummaryText(
  q: {
    client_name: string;
    project_summary: string;
    estimated_min: number;
    estimated_max: number;
    is_rush: boolean;
    scope_breakdown: ScopeBreakdown;
  },
  editorName?: string | null
) {
  const s = q.scope_breakdown;
  const cur = s.currency || "USD";
  const lines = [
    `Hi ${q.client_name.split(" ")[0] || "there"} — here's your project estimate${editorName ? ` from ${editorName}` : ""}:`,
    "",
    `Project: ${q.project_summary}`,
    `Estimate: ${money(q.estimated_min, cur)} – ${money(q.estimated_max, cur)}${q.is_rush ? " (rush delivery included)" : ""}`,
    "",
    "Deliverables:",
    ...s.deliverables.map((d) => `• ${d}`),
    "",
    `Turnaround: ${s.timeline}`,
    `Revisions: ${s.revision_terms}`,
  ];
  if (s.terms) lines.push(`Terms: ${s.terms}`);
  lines.push("", "Reply here to lock it in and I'll send over next steps.");
  return lines.join("\n");
}
