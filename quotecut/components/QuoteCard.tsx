import { BadgeCheck, CalendarClock, ListChecks, RefreshCw, Zap } from "lucide-react";
import type { QuoteResult } from "@/lib/types";
import { SERVICE_LABEL, money } from "@/lib/quote";

export default function QuoteCard({
  quote,
  editorName,
  clientName,
}: {
  quote: QuoteResult;
  editorName: string;
  clientName?: string;
}) {
  const s = quote.scope_breakdown;
  const cur = s.currency || "USD";

  return (
    <div className="card animate-rise overflow-hidden">
      <div className="border-b border-line bg-gradient-to-b from-accent/15 to-transparent p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
          <BadgeCheck size={14} /> Official Project Estimate
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Prepared by {editorName}
          {clientName ? ` for ${clientName}` : ""}
        </p>
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Estimated price</div>
          <div className="mt-1 text-4xl font-extrabold tracking-tight">
            {money(quote.estimated_min, cur)}
            <span className="mx-1.5 text-zinc-600">–</span>
            {money(quote.estimated_max, cur)}
          </div>
          {quote.is_rush && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
              <Zap size={12} /> Rush delivery included
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5 text-sm">
        <p className="text-zinc-300">{quote.project_summary}</p>

        <div className="space-y-1.5">
          {s.items.map((i) => (
            <div key={i.service} className="flex justify-between text-zinc-400">
              <span>
                {i.quantity} × {SERVICE_LABEL[i.service]}
              </span>
              <span className="text-zinc-300">{money(i.line_total, cur)}</span>
            </div>
          ))}
        </div>

        <Section icon={<ListChecks size={15} />} title="Included deliverables">
          <ul className="space-y-1.5">
            {s.deliverables.map((d, i) => (
              <li key={i} className="flex gap-2 text-zinc-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {d}
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={<CalendarClock size={15} />} title="Estimated turnaround">
          <p className="text-zinc-300">{s.timeline}</p>
        </Section>

        <Section icon={<RefreshCw size={15} />} title="Revision terms">
          <p className="text-zinc-300">{s.revision_terms}</p>
          {s.terms && <p className="mt-1.5 text-zinc-400">{s.terms}</p>}
        </Section>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}
