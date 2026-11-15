import Link from "next/link";
import { Check } from "lucide-react";

const CHECKOUT = process.env.NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL;

const free = ["Your own /handle bio link", "3 quotes per month", "AI scoping + instant estimates", "Lead inbox & copy-to-client"];
const pro = ["Unlimited quotes", "Custom branding (no 'Powered by')", "Everything in Free", "Priority support"];

export default function PricingPreview() {
  return (
    <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
      <div className="card p-6">
        <h3 className="text-lg font-semibold">Free</h3>
        <p className="mt-1 text-4xl font-extrabold">
          $0<span className="text-base font-medium text-zinc-500">/mo</span>
        </p>
        <ul className="mt-5 space-y-2.5 text-sm text-zinc-300">
          {free.map((f) => (
            <li key={f} className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-accent" /> {f}
            </li>
          ))}
        </ul>
        <Link href="/login" className="btn-ghost mt-6 w-full">
          Start free
        </Link>
      </div>

      <div className="card relative border-accent/60 p-6 shadow-[0_0_40px_-12px_#10B981]">
        <span className="absolute -top-3 right-5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-zinc-950">
          Most popular
        </span>
        <h3 className="text-lg font-semibold">Pro</h3>
        <p className="mt-1 text-4xl font-extrabold">
          $9<span className="text-base font-medium text-zinc-500">/mo</span>
        </p>
        <ul className="mt-5 space-y-2.5 text-sm text-zinc-300">
          {pro.map((f) => (
            <li key={f} className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-accent" /> {f}
            </li>
          ))}
        </ul>
        {/* Lemon Squeezy placeholder: set NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL to your checkout link */}
        {CHECKOUT ? (
          <a href={CHECKOUT} className="btn-primary mt-6 w-full">
            Upgrade to Pro
          </a>
        ) : (
          <Link href="/login" className="btn-primary mt-6 w-full">
            Get Pro — checkout coming soon
          </Link>
        )}
      </div>
    </div>
  );
}
