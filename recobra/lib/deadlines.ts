import type { Platform } from "@/lib/parsers/types";

export type DeadlineAnchor = "order_date" | "deduction_date";
export interface DeadlineRule { days: number; anchor: DeadlineAnchor }

/** Defaults; overridable per client via clients.deadline_overrides. See docs/decisions.md. */
export const DEFAULT_DEADLINE_RULES: Record<Platform, DeadlineRule> = {
  ubereats: { days: 30, anchor: "order_date" },
  glovo: { days: 30, anchor: "deduction_date" },
  justeat: { days: 14, anchor: "deduction_date" },
};

export type DeadlineOverrides = Partial<Record<Platform, Partial<DeadlineRule>>>;

export function computeDeadline(
  platform: Platform,
  dates: { orderedAt: string | null; deductedAt: string | null },
  overrides: DeadlineOverrides = {},
): string | null {
  const rule = { ...DEFAULT_DEADLINE_RULES[platform], ...overrides[platform] };
  const base = rule.anchor === "order_date" ? (dates.orderedAt ?? dates.deductedAt) : (dates.deductedAt ?? dates.orderedAt);
  if (!base) return null;
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + rule.days);
  return d.toISOString();
}

export type DeadlineState = "expired" | "urgent" | "soon" | "ok" | "unknown";

export function deadlineState(deadlineAt: string | null, now = new Date()): { state: DeadlineState; daysLeft: number | null } {
  if (!deadlineAt) return { state: "unknown", daysLeft: null };
  const daysLeft = Math.floor((new Date(deadlineAt).getTime() - now.getTime()) / 86_400_000);
  if (new Date(deadlineAt).getTime() <= now.getTime()) return { state: "expired", daysLeft };
  if (daysLeft <= 3) return { state: "urgent", daysLeft };
  if (daysLeft <= 7) return { state: "soon", daysLeft };
  return { state: "ok", daysLeft };
}
