import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function login(formData: FormData) {
  "use server";
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) redirect("/login?error=1");
  redirect("/deducciones");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form action={login} className="mx-auto mt-24 flex max-w-sm flex-col gap-3 rounded-lg border bg-white p-6">
      <h1 className="text-lg font-semibold">Acceso</h1>
      {error && <p className="text-sm text-red-600">Credenciales incorrectas.</p>}
      <input name="email" type="email" required placeholder="Email" className="rounded border px-3 py-2" />
      <input name="password" type="password" required placeholder="Contraseña" className="rounded border px-3 py-2" />
      <button className="rounded bg-slate-900 px-3 py-2 text-white">Entrar</button>
    </form>
  );
}
