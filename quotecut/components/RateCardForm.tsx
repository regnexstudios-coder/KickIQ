"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, PartyPopper } from "lucide-react";
import CopyButton from "./CopyButton";
import { createClient } from "@/lib/supabase/client";
import { HANDLE_RE, RESERVED_HANDLES, SITE_DOMAIN, type Profile, type Rates } from "@/lib/types";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR"];

export default function RateCardForm({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [handle, setHandle] = useState(profile.handle ?? "");
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [currency, setCurrency] = useState(profile.currency || "USD");
  const [notes, setNotes] = useState(profile.custom_notes ?? "");
  const [shortForm, setShortForm] = useState(String(profile.rates.short_form));
  const [longForm, setLongForm] = useState(String(profile.rates.long_form));
  const [thumb, setThumb] = useState(String(profile.rates.thumbnail));
  const [rushPct, setRushPct] = useState(String(Math.round((profile.rates.rush_multiplier - 1) * 100)));
  const [minBudget, setMinBudget] = useState(String(profile.rates.min_budget));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const firstTime = !profile.handle;
  const link = `${SITE_DOMAIN}/${profile.handle ?? handle}`;
  const fullUrl = `${process.env.NEXT_PUBLIC_SITE_URL || `https://${SITE_DOMAIN}`}/${profile.handle ?? handle}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    const h = handle.trim().toLowerCase();
    if (!HANDLE_RE.test(h)) return setError("Handle must be 3–20 lowercase letters or numbers (no spaces or symbols).");
    if (RESERVED_HANDLES.includes(h)) return setError("That handle is reserved. Try another.");

    const nums = [shortForm, longForm, thumb, minBudget].map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return setError("Rates must be positive numbers.");
    if (nums.slice(0, 3).some((n) => n === 0)) return setError("Set a rate above 0 for each service.");
    const rush = Number(rushPct);
    if (!Number.isFinite(rush) || rush < 0 || rush > 300) return setError("Rush fee must be between 0% and 300%.");

    const rates: Rates = {
      short_form: nums[0],
      long_form: nums[1],
      thumbnail: nums[2],
      rush_multiplier: Math.round((1 + rush / 100) * 100) / 100,
      min_budget: nums[3],
    };

    setSaving(true);
    const supabase = createClient();
    const patch = {
      handle: h,
      display_name: displayName.trim() || null,
      tagline: tagline.trim() || null,
      currency,
      rates,
      custom_notes: notes.trim() || null,
    };
    const { error: err } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    setSaving(false);

    if (err) {
      setError(err.code === "23505" ? "That handle is already taken. Try another." : err.message);
      return;
    }
    onSaved({ ...profile, ...patch });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {firstTime && (
        <div className="flex gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <PartyPopper className="mt-0.5 shrink-0 text-accent" size={18} />
          <div>
            <p className="font-semibold text-accent">Welcome to QuoteCut! 🎉</p>
            <p className="mt-0.5 text-zinc-300">Claim your unique handle and set your rates — your bio link goes live the moment you save.</p>
          </div>
        </div>
      )}

      {/* Handle + link */}
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Your bio link</h2>
        <div>
          <label className="label" htmlFor="handle">Handle</label>
          <div className="flex items-center rounded-xl border border-line bg-bg focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
            <span className="pl-3.5 text-zinc-500">{SITE_DOMAIN}/</span>
            <input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
              maxLength={20}
              placeholder="alex"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full bg-transparent px-1 py-3 text-base outline-none"
            />
          </div>
        </div>
        {profile.handle && (
          <div className="flex gap-2">
            <CopyButton text={fullUrl} label={`Copy ${link}`} className="flex-1 !justify-start truncate" variant="primary" />
            <a href={`/${profile.handle}`} target="_blank" rel="noreferrer" className="btn-ghost" aria-label="Open public page">
              <ExternalLink size={16} />
            </a>
          </div>
        )}
      </section>

      {/* Profile */}
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Public profile</h2>
        <div>
          <label className="label" htmlFor="dn">Display name</label>
          <input id="dn" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} placeholder="Alex Rivera" />
        </div>
        <div>
          <label className="label" htmlFor="tl">Tagline</label>
          <input id="tl" className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} placeholder="High-retention Reels & YouTube Edits" />
        </div>
      </section>

      {/* Rates */}
      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Rate card</h2>
          <select className="rounded-lg border border-line bg-bg px-2 py-1.5 text-sm" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Num label="Short-form video (Reels/TikTok/Shorts)" value={shortForm} onChange={setShortForm} hint="per video" />
          <Num label="Long-form YouTube video" value={longForm} onChange={setLongForm} hint="per video" />
          <Num label="Thumbnail" value={thumb} onChange={setThumb} hint="per thumbnail" />
          <Num label="Minimum project budget" value={minBudget} onChange={setMinBudget} hint="hard floor on every quote" />
          <Num label="Rush delivery fee" value={rushPct} onChange={setRushPct} hint="% added when deadline is tight" suffix="%" step="5" />
        </div>
      </section>

      {/* Notes */}
      <section className="card p-4">
        <label className="label" htmlFor="notes">Custom terms &amp; notes</label>
        <textarea
          id="notes"
          rows={3}
          className="input resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={400}
          placeholder="Includes 2 free revisions. 50% upfront."
        />
        <p className="mt-1.5 text-xs text-zinc-500">Shown on every quote and respected by the AI when it writes scope &amp; revision terms.</p>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn-primary w-full" disabled={saving}>
        {saving ? <Loader2 className="animate-spin" size={16} /> : saved ? <Check size={16} /> : null}
        {saved ? "Saved!" : firstTime ? "Claim handle & go live" : "Save changes"}
      </button>
    </form>
  );
}

function Num({
  label,
  value,
  onChange,
  hint,
  suffix,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  suffix?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="label normal-case tracking-normal">{label}</label>
      <div className="relative">
        <input className="input pr-9" type="number" inputMode="decimal" min={0} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
