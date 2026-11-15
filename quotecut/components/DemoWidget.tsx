"use client";

import { Sparkles } from "lucide-react";
import Intake from "./Intake";

export default function DemoWidget() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-3 flex items-center justify-center gap-2 text-sm text-zinc-400">
        <Sparkles size={14} className="text-accent" />
        Live demo — you&apos;re the client. Takes ~15 seconds.
      </div>
      <div className="rounded-[28px] border border-line bg-bg p-2 shadow-[0_0_80px_-30px_#10B981]">
        <div className="rounded-[22px] bg-gradient-to-b from-zinc-900/60 to-transparent p-3">
          <div className="mb-3 text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-accent to-lime-400 font-extrabold text-zinc-950">
              A
            </div>
            <div className="font-semibold">Alex Rivera</div>
            <div className="text-xs text-zinc-400">High-retention Reels &amp; YouTube Edits</div>
            <span className="mt-2 inline-block rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
              Starting at $25
            </span>
          </div>
          <Intake demo editorName="Alex Rivera" />
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-zinc-500">
        Demo rates: short-form $50 · long-form $150 · thumbnail $25 · rush +30% · $100 minimum
      </p>
    </div>
  );
}
