import { deadlineState, type DeadlineState } from "@/lib/deadlines";

const STYLE: Record<DeadlineState, string> = {
  expired: "bg-slate-200 text-slate-600",
  urgent: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-800",
  ok: "bg-emerald-100 text-emerald-700",
  unknown: "bg-slate-100 text-slate-500",
};

export function DeadlineBadge({ deadlineAt }: { deadlineAt: string | null }) {
  const { state, daysLeft } = deadlineState(deadlineAt);
  const label = state === "expired" ? "Vencida" : state === "unknown" ? "Sin fecha" : `${daysLeft} d`;
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${STYLE[state]}`}>{label}</span>;
}
