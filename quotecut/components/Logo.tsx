import Link from "next/link";
import { Scissors } from "lucide-react";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-bold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-zinc-950">
        <Scissors size={15} strokeWidth={2.6} />
      </span>
      <span>
        Quote<span className="text-accent">Cut</span>
      </span>
    </Link>
  );
}
