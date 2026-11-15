import Link from "next/link";
import { ArrowRight, Calculator, MessageSquareText, Smartphone } from "lucide-react";
import Logo from "@/components/Logo";
import DemoWidget from "@/components/DemoWidget";
import PricingPreview from "@/components/PricingPreview";

export default function Landing() {
  return (
    <div className="overflow-x-hidden">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="#pricing" className="hidden px-3 text-sm text-zinc-400 hover:text-zinc-200 sm:block">
            Pricing
          </Link>
          <Link href="/login" className="btn-primary !py-2">
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-5xl px-4 pb-16 pt-10 text-center sm:pt-16">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
        <span className="relative rounded-full border border-line bg-card px-3 py-1 text-xs text-zinc-400">
          Built for video editors &amp; thumbnail designers
        </span>
        <h1 className="relative mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
          Replace <span className="text-zinc-500 line-through decoration-accent">&lsquo;DM for rates&rsquo;</span> in your bio with an AI link that{" "}
          <span className="text-accent">scopes clients</span> and sends instant quotes.
        </h1>
        <p className="relative mx-auto mt-5 max-w-xl text-lg text-zinc-400">
          Clients answer 4 quick questions. They get a professional estimate based on <em>your</em> rates. You get a qualified lead.
        </p>
        <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/login" className="btn-primary w-full px-6 sm:w-auto">
            Claim your link free <ArrowRight size={16} />
          </Link>
          <Link href="#demo" className="btn-ghost w-full px-6 sm:w-auto">
            Try the live demo
          </Link>
        </div>
      </section>

      <section id="demo" className="mx-auto max-w-5xl scroll-mt-6 px-4 pb-20">
        <DemoWidget />
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-20 sm:grid-cols-3">
        {[
          { icon: Smartphone, t: "Feels like an app", d: "Mobile-first link that loads instantly. No account needed for clients." },
          { icon: MessageSquareText, t: "AI does the scoping", d: "Adaptive questions turn vague DMs into a clear deliverable list and timeline." },
          { icon: Calculator, t: "Your math, enforced", d: "Quotes use your exact rates, rush fee and minimum budget — never a made-up number." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="card p-5">
            <Icon className="text-accent" size={22} />
            <h3 className="mt-3 font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-zinc-400">{d}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="mx-auto max-w-5xl scroll-mt-6 px-4 pb-24">
        <h2 className="mb-8 text-center text-3xl font-bold">Simple pricing</h2>
        <PricingPreview />
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} QuoteCut
      </footer>
    </div>
  );
}
