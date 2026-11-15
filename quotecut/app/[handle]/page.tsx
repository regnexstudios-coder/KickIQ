import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Intake from "@/components/Intake";
import { DEFAULT_RATES, type Profile } from "@/lib/types";
import { money } from "@/lib/quote";

export const dynamic = "force-dynamic";

async function getProfile(handle: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("handle", handle.toLowerCase()).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const p = await getProfile(handle);
  if (!p) return { title: "QuoteCut" };
  return {
    title: `${p.display_name || handle} — Get an instant quote`,
    description: p.tagline || "Answer 4 quick questions and get an instant project estimate.",
  };
}

export default async function PublicIntakePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getProfile(handle);
  if (!profile) notFound();

  const rates = { ...DEFAULT_RATES, ...profile.rates };
  const name = profile.display_name || `@${profile.handle}`;
  const cur = profile.currency || "USD";
  const starting = Math.min(...[rates.short_form, rates.long_form, rates.thumbnail].filter((n) => n > 0));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 pt-8">
      <header className="text-center">
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-accent to-lime-400 text-2xl font-extrabold text-zinc-950">
          {name.replace("@", "").charAt(0).toUpperCase()}
        </div>
        <h1 className="text-xl font-bold">{name}</h1>
        {profile.tagline && <p className="mt-1 text-sm text-zinc-400">{profile.tagline}</p>}
        {Number.isFinite(starting) && (
          <span className="mt-3 inline-block rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            Starting at {money(starting, cur)}
          </span>
        )}
      </header>

      <section className="mt-6 flex-1">
        <p className="mb-3 text-center text-sm text-zinc-400">Answer 4 quick questions — get your quote in seconds.</p>
        <Intake handle={profile.handle!} editorName={name} />
      </section>

      {profile.plan !== "pro" && (
        <footer className="mt-8 text-center text-xs text-zinc-600">
          <a href="/" className="hover:text-zinc-400">
            Powered by <span className="text-accent">QuoteCut</span>
          </a>
        </footer>
      )}
    </main>
  );
}
