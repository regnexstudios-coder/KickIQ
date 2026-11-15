import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetupNotice from "@/components/SetupNotice";
import { hasSupabaseEnv } from "@/lib/env";
import DashboardClient from "@/components/DashboardClient";
import { DEFAULT_RATES, type Profile, type Quote } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — QuoteCut" };

export default async function DashboardPage() {
  if (!hasSupabaseEnv()) return <SetupNotice />;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  // Safety net if the signup trigger hasn't run for this user
  if (!profile) {
    await supabase.from("profiles").insert({ id: user.id, display_name: user.email?.split("@")[0] ?? "" });
    ({ data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle());
  }
  if (!profile) redirect("/login?error=profile");

  const { data: quotes } = await supabase
    .from("quotes")
    .select("*")
    .eq("editor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthCount = (quotes ?? []).filter((q) => new Date(q.created_at) >= monthStart).length;

  const p = { ...(profile as Profile), rates: { ...DEFAULT_RATES, ...(profile as Profile).rates } };

  return <DashboardClient profile={p} initialQuotes={(quotes ?? []) as Quote[]} monthCount={monthCount} email={user.email ?? ""} />;
}
