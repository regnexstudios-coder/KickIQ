"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import clsx from "clsx";
import { computePricing, money } from "@/lib/quote";
import { SITE_DOMAIN, type Rates } from "@/lib/types";

/** Phone-frame preview of the public bio link, driven by the unsaved form values. */
export default function LivePreview({
  name,
  tagline,
  handle,
  currency,
  rates,
  notes,
}: {
  name: string;
  tagline: string;
  handle: string;
  currency: string;
  rates: Rates;
  notes: string;
}) {
  const [rush, setRush] = useState(false);
  const positive = [rates.short_form, rates.long_form, rates.thumbnail].filter((n) => n > 0);
  const starting = positive.length ? Math.min(...positive) : 0;
  const sample = computePricing({ items: [{ service: "short_form", quantity: 4 }], is_rush: rush, complexity: 1 }, rates);
  const shown = name.trim() || "Your name";

  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Live preview</div>
      <div className="mx-auto w-full max-w-[300px] rounded-[28px] border border-line bg-bg p-2">
        <div className="rounded-[22px] border border-line/60 bg-bg p-4">
          <div className="mb-3 truncate text-center text-[10px] text-zinc-600">
            {SITE_DOMAIN}/{handle || "yourhandle"}
          </div>
          <div className="text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-accent to-lime-400 text-lg font-extrabold text-zinc-950">
              {shown.charAt(0).toUpperCase()}
            </div>
            <div className="font-semibold">{shown}</div>
            <div className="mt-0.5 text-xs text-zinc-400">{tagline.trim() || "Your tagline"}</div>
            {starting > 0 && (
              <span className="mt-2 inline-block rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                Starting at {money(starting, currency)}
              </span>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-line bg-card p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-accent">Sample estimate · 4 short-form</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight">
              {money(sample.estimated_min, currency)}
              <span className="mx-1 text-zinc-600">–</span>
              {money(sample.estimated_max, currency)}
            </div>
            <button
              type="button"
              onClick={() => setRush((r) => !r)}
              className={clsx(
                "mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                rush ? "bg-amber-500/15 text-amber-300" : "border border-line text-zinc-400"
              )}
            >
              <Zap size={11} /> Rush {rush ? "on" : "off"}
            </button>
            {notes.trim() && <p className="mt-2 text-[11px] leading-snug text-zinc-400">{notes.trim()}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
