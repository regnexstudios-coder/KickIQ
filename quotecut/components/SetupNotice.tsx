import { TriangleAlert } from "lucide-react";

export default function SetupNotice({ title = "Supabase isn't configured yet" }: { title?: string }) {
  return (
    <div className="card mx-auto my-10 max-w-md p-6 text-sm">
      <div className="flex items-center gap-2 font-semibold text-amber-300">
        <TriangleAlert size={18} /> {title}
      </div>
      <p className="mt-2 text-zinc-400">
        Add <code className="text-zinc-200">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="text-zinc-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your environment (see{" "}
        <code className="text-zinc-200">.env.example</code>), run <code className="text-zinc-200">supabase/schema.sql</code>, then redeploy.
      </p>
    </div>
  );
}
