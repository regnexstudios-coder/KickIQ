import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center">
      <div>
        <Logo />
        <h1 className="mt-8 text-2xl font-bold">Link not found</h1>
        <p className="mt-2 text-zinc-400">This QuoteCut link doesn&apos;t exist (yet). Is it yours?</p>
        <Link href="/login" className="btn-primary mt-6">
          Claim it free
        </Link>
      </div>
    </main>
  );
}
