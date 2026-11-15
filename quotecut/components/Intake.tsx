"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import clsx from "clsx";
import QuoteCard from "./QuoteCard";
import type { QuoteResult } from "@/lib/types";

interface Step {
  question: string;
  placeholder: string;
  chips: string[];
}

/** Questions adapt to what the client said they need in step 1. */
function buildSteps(need: string): Step[] {
  const t = need.toLowerCase();
  const thumb = /thumb/.test(t) && !/(video|reel|tiktok|short|edit)/.test(t);
  const long = /(youtube|long|podcast|vlog)/.test(t);
  return [
    {
      question: "What do you need edited?",
      placeholder: "e.g. 10 TikToks cut from my podcast episodes",
      chips: ["Reels / TikTok / Shorts", "YouTube long-form", "Thumbnails", "Videos + thumbnails"],
    },
    {
      question: thumb
        ? "How many thumbnails do you need, and what are the videos about?"
        : long
          ? "How many videos, and about how long is the raw footage for each?"
          : "How many videos/thumbnails, and roughly how long is the footage?",
      placeholder: thumb ? "e.g. 4 thumbnails for gaming videos" : "e.g. 8 clips, ~45 min raw footage each",
      chips: thumb ? ["1 thumbnail", "4 thumbnails", "10 thumbnails"] : ["4 videos, under 10 min", "10 videos, ~30 min", "1 video, 20+ min"],
    },
    {
      question: "What style or reference are you going for, and what's your deadline?",
      placeholder: "e.g. Hormozi-style captions, fast cuts. Need it in 5 days",
      chips: ["Rush — within 48 hours", "This week", "No rush (2+ weeks)"],
    },
    {
      question: "Last one — your name and email or X/Discord handle?",
      placeholder: "",
      chips: [],
    },
  ];
}

type Msg = { from: "bot" | "me"; text: string };

export default function Intake({
  handle,
  demo,
  editorName,
  onDone,
}: {
  handle?: string;
  demo?: boolean;
  editorName: string;
  onDone?: () => void;
}) {
  const [answers, setAnswers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ quote: QuoteResult; saved: boolean; clientName: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const steps = buildSteps(answers[0] ?? "");
  const step = answers.length;

  const msgs: Msg[] = [];
  for (let i = 0; i <= Math.min(step, 3); i++) {
    msgs.push({ from: "bot", text: steps[i].question });
    if (i < answers.length) msgs.push({ from: "me", text: answers[i] });
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [step, loading, result]);

  function next(value: string) {
    const v = value.trim();
    if (!v) return;
    setAnswers((a) => [...a, v]);
    setInput("");
  }

  async function submit() {
    if (!name.trim() || !contact.trim()) return setError("Add your name and a way to reach you.");
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/generate-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          demo,
          questions: steps.map((s) => s.question),
          answers: { need: answers[0], volume: answers[1], style: answers[2], name: name.trim(), contact: contact.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setResult({ quote: data.quote, saved: data.saved, clientName: name.trim() });
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setAnswers([]);
    setInput("");
    setName("");
    setContact("");
    setResult(null);
    setError("");
  }

  if (result) {
    return (
      <div className="space-y-4">
        <QuoteCard quote={result.quote} editorName={editorName} clientName={result.clientName} />
        {!demo && (
          <p className="text-center text-sm text-zinc-400">
            {result.saved
              ? `✅ Sent to ${editorName}. They'll reach out at ${contact} to lock it in.`
              : `Screenshot this estimate and send it to ${editorName} to get started.`}
          </p>
        )}
        {demo && (
          <button onClick={reset} className="btn-ghost w-full">
            <RotateCcw size={15} /> Try another project
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card p-4">
      {/* progress */}
      <div className="mb-4 flex items-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={clsx("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-line")} />
        ))}
        <span className="ml-2 text-xs text-zinc-500">{Math.min(step + 1, 4)}/4</span>
      </div>

      <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
        {msgs.map((m, i) => (
          <div key={i} className={clsx("flex animate-rise", m.from === "me" && "justify-end")}>
            <div
              className={clsx(
                "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug",
                m.from === "bot" ? "rounded-bl-md bg-zinc-800 text-zinc-100" : "rounded-br-md bg-accent text-zinc-950"
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="animate-spin" size={16} /> Scoping your project…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!loading && step < 3 && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            next(input);
          }}
        >
          <div className="flex flex-wrap gap-2">
            {steps[step].chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setInput((v) => (step === 2 && v ? `${v}. ${c}` : c))}
                className="rounded-full border border-line px-3 py-1.5 text-xs text-zinc-300 transition hover:border-accent hover:text-accent"
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={steps[step].placeholder}
              maxLength={500}
              autoFocus
              enterKeyHint="send"
            />
            <button className="btn-primary px-4" disabled={!input.trim()} aria-label="Next">
              <Send size={18} />
            </button>
          </div>
        </form>
      )}

      {!loading && step === 3 && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80} autoComplete="name" autoFocus />
          <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email, @X handle or Discord" maxLength={120} autoComplete="email" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary w-full" disabled={!name.trim() || !contact.trim()}>
            <Sparkles size={16} /> Get my instant quote <ArrowRight size={16} />
          </button>
        </form>
      )}

      {!loading && step < 3 && error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
