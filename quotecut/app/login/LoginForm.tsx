"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";

type Mode = "signup" | "login" | "magic";

export default function LoginForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");

  const siteUrl = () => (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard` },
        });
        if (error) throw error;
        setNotice("Check your email — we sent you a magic link.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard` },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setNotice("Almost there — confirm your email using the link we just sent.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: Mode; label: string }[] = [
    { key: "signup", label: "Sign up" },
    { key: "login", label: "Log in" },
    { key: "magic", label: "Magic link" },
  ];

  return (
    <div className="card p-5">
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-bg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setMode(t.key);
              setError("");
              setNotice("");
            }}
            className={clsx(
              "rounded-lg py-2 text-sm font-medium transition",
              mode === t.key ? "bg-card text-accent" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
        </div>
        {mode !== "magic" && (
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {notice && <p className="rounded-lg bg-accent/10 p-3 text-sm text-accent">{notice}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={16} /> : mode === "magic" ? <Mail size={16} /> : null}
          {mode === "signup" ? "Create account" : mode === "login" ? "Log in" : "Email me a magic link"}
        </button>
      </form>
    </div>
  );
}
