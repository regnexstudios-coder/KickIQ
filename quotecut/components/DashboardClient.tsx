"use client";

import { useState } from "react";
import { Inbox, LogOut, SlidersHorizontal } from "lucide-react";
import clsx from "clsx";
import Logo from "./Logo";
import RateCardForm from "./RateCardForm";
import LeadsList from "./LeadsList";
import { FREE_MONTHLY_LIMIT, type Profile, type Quote } from "@/lib/types";

export default function DashboardClient({
  profile,
  initialQuotes,
  monthCount,
  email,
}: {
  profile: Profile;
  initialQuotes: Quote[];
  monthCount: number;
  email: string;
}) {
  const [tab, setTab] = useState<"rates" | "leads">(profile.handle ? "leads" : "rates");
  const [current, setCurrent] = useState(profile);
  const newCount = initialQuotes.filter((q) => q.status === "new").length;

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <Logo href="/dashboard" />
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-zinc-500 sm:block">{email}</span>
          <form action="/auth/signout" method="post">
            <button className="btn-ghost !px-3 !py-2" aria-label="Sign out">
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </header>

      {current.plan === "free" && (
        <div className="mx-auto mb-4 flex max-w-2xl items-center justify-between rounded-xl border border-line bg-card px-4 py-3 text-sm">
          <span className="text-zinc-400">
            Free plan · <span className="font-semibold text-zinc-200">{Math.min(monthCount, FREE_MONTHLY_LIMIT)}/{FREE_MONTHLY_LIMIT}</span> quotes this month
          </span>
          {monthCount >= FREE_MONTHLY_LIMIT && <span className="text-xs font-medium text-amber-300">Limit reached — upgrade for unlimited</span>}
        </div>
      )}

      <div className="mx-auto mb-5 grid max-w-2xl grid-cols-2 gap-1 rounded-xl border border-line bg-card p-1">
        <TabBtn active={tab === "rates"} onClick={() => setTab("rates")} icon={<SlidersHorizontal size={16} />}>
          Rate Card &amp; Link
        </TabBtn>
        <TabBtn active={tab === "leads"} onClick={() => setTab("leads")} icon={<Inbox size={16} />} badge={newCount}>
          Leads &amp; Quotes
        </TabBtn>
      </div>

      {tab === "rates" ? (
        <RateCardForm profile={current} onSaved={(p) => setCurrent(p)} />
      ) : (
        <div className="mx-auto max-w-2xl">
          <LeadsList initial={initialQuotes} editorName={current.display_name || current.handle} hasHandle={!!current.handle} onSetup={() => setTab("rates")} />
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition",
        active ? "bg-bg text-accent" : "text-zinc-400 hover:text-zinc-200"
      )}
    >
      {icon}
      {children}
      {!!badge && <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-zinc-950">{badge}</span>}
    </button>
  );
}
