import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";
import SetupNotice from "@/components/SetupNotice";
import { hasSupabaseEnv } from "@/lib/env";

export const metadata = { title: "Log in — QuoteCut" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-sm content-center px-4 py-10">
      <div className="mb-8 text-center">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold">Claim your quote link</h1>
        <p className="mt-1 text-sm text-zinc-400">Sign up free. Takes under a minute.</p>
      </div>
      {hasSupabaseEnv() ? <LoginForm initialError={error ? "That link didn't work. Please try again." : ""} /> : <SetupNotice />}
    </main>
  );
}
