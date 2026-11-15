"use client";

import { useState } from "react";
import { Clock, Inbox, Mail, Zap } from "lucide-react";
import clsx from "clsx";
import CopyButton from "./CopyButton";
import { createClient } from "@/lib/supabase/client";
import { money, quoteSummaryText } from "@/lib/quote";
import type { Quote, QuoteStatus } from "@/lib/types";

const STATUSES: { key: QuoteStatus; label: string }[] = [
  { key: "new", label: "New" },
  { key: "accepted", label: "Accepted" },
  { key: "archived", label: "Archived" },
];

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

export default function LeadsList({
  initial,
  editorName,
  hasHandle,
  onSetup,
}: {
  initial: Quote[];
  editorName: string | null;
  hasHandle: boolean;
  onSetup: () => void;
}) {
  const [quotes, setQuotes] = useState(initial);
  const [filter, setFilter] = useState<QuoteStatus | "all">("all");
  const [error, setError] = useState("");

  async function setStatus(id: string, status: QuoteStatus) {
    const prev = quotes;
    setQuotes((qs) => qs.map((q) => (q.id === id ? { ...q, status } : q))); // optimistic
    setError("");
    const { error } = await createClient().from("quotes").update({ status }).eq("id", id);
    if (error) {
      setQuotes(prev);
      setError("Couldn't update status. Try again.");
    }
  }

  const visible = quotes.filter((q) => (filter === "all" ? true : q.status === filter));

  if (quotes.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Inbox className="mx-auto text-zinc-600" size={32} />
        <h2 className="mt-3 font-semibold">No leads yet</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {hasHandle ? "Put your link in your bio — quotes will land here instantly." : "Claim your handle first so clients can reach you."}
        </p>
        {!hasHandle && (
          <button onClick={onSetup} className="btn-primary mt-4">
            Set up my link
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", ...STATUSES.map((s) => s.key)] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize",
              filter === f ? "border-accent bg-accent/10 text-accent" : "border-line text-zinc-400"
            )}
          >
            {f} {f === "all" ? quotes.length : quotes.filter((q) => q.status === f).length}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {visible.map((q) => {
        const cur = q.scope_breakdown?.currency || "USD";
        return (
          <article key={q.id} className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{q.client_name}</h3>
                <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-zinc-400">
                  <Mail size={13} className="shrink-0" /> {q.client_contact}
                </p>
              </div>
              <div className="text-right">
                <div className="font-bold text-accent">
                  {money(q.estimated_min, cur)}–{money(q.estimated_max, cur)}
                </div>
                <div className="mt-0.5 flex items-center justify-end gap-1 text-xs text-zinc-500">
                  <Clock size={11} /> {ago(q.created_at)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 capitalize text-zinc-300">
                {q.quantity} × {q.service_type.replace("_", "-")}
              </span>
              {q.is_rush && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300">
                  <Zap size={11} /> Rush
                </span>
              )}
            </div>

            <p className="text-sm text-zinc-300">{q.project_summary}</p>

            {q.scope_breakdown?.deliverables?.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">Scope &amp; deliverables</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-300">
                  {q.scope_breakdown.deliverables.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
                <p className="mt-2 text-zinc-400">⏱ {q.scope_breakdown.timeline}</p>
              </details>
            )}

            <div className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-bg p-1">
                {STATUSES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => q.status !== s.key && setStatus(q.id, s.key)}
                    className={clsx(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition",
                      q.status === s.key
                        ? s.key === "accepted"
                          ? "bg-accent text-zinc-950"
                          : "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <CopyButton text={quoteSummaryText(q, editorName)} label="Copy Quote Summary" copiedLabel="Copied to clipboard" />
            </div>
          </article>
        );
      })}
    </div>
  );
}
