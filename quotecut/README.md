# QuoteCut

AI-powered client intake + instant quoting bio-link for short-form video editors and thumbnail designers.

Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Auth + Postgres + RLS) · Vercel AI SDK (`generateObject`, Google or OpenAI).

## How quoting works
The AI only **scopes** the project (services, counts, rush, complexity, deliverables, timeline, revision terms) via structured output.
All dollar amounts are computed in code (`lib/quote.ts`) from the editor's exact rates:

- `line = unit_rate × qty × complexity (0.8–1.5)`
- `range = subtotal × [0.9, 1.2] × (rush ? rush_multiplier : 1)`
- both ends are raised to `min_budget`

With no AI key (or on provider error) a deterministic heuristic scoper is used so the product never hard-fails.

## Local setup
```bash
cd quotecut
cp .env.example .env.local   # fill in Supabase + AI keys
# run supabase/schema.sql in the Supabase SQL editor
npm install
npm run dev
```

## Supabase config
- Auth → URL Configuration: set **Site URL** to your domain and add `https://YOUR_DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback`) to **Redirect URLs**.
- Optional for faster onboarding: turn off "Confirm email" in Auth → Providers → Email.

## Free-tier limit
Free plan = 3 saved quotes/month, enforced server-side via the `quotes_this_month()` SQL function. Over the limit the client still sees their estimate, but the lead isn't saved. `profiles.plan` is not editable by users (column grants); flip it to `pro` from your Lemon Squeezy webhook using the service role.
