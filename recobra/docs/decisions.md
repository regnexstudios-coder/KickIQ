# Decisions & tradeoffs

Newest last. Each entry: what, why, what it costs.

1. **Lives in `recobra/` inside the KickIQ repo (temporary).** The brief's repo was unavailable; the folder is self-contained
   (own package.json, no imports from the Expo app) so `git subtree split` / copy moves it out cleanly.
   It must get its **own EU Supabase project** — never reuse the KickIQ one.
2. **Fixtures are synthetic.** No real exports were available. Header matching is fuzzy (accent/case/order-insensitive, ES/EN
   synonyms), but real Uber Eats / Glovo exports are unverified until real samples are added. Expect to extend synonym lists.
3. **Payment Details yields credits + gross sales only, not deductions.** Deductions come from Order Errors; emitting them from both
   would double count (different dates → different dedupe keys).
4. **Uber Eats `deducted_at` = order date** (its dispute window is order-based). Glovo `deducted_at` = payout line date.
5. **Deadlines:** Uber Eats 30d from order date; Glovo 30d from deduction date (assumption — confirm against Glovo's terms);
   Just Eat 14d. Overridable per client in `clients.deadline_overrides`.
6. **Dedupe:** same file (sha256) is a no-op per client; overlapping exports dedupe on
   `unique nulls not distinct (order, platform, reason_raw, amount, deducted_at)`. `nulls not distinct` needs Postgres 15+ (Supabase OK).
   Two *genuinely identical* deductions on one order/day would collapse into one — acceptable for v1, revisit if real data shows it.
7. **PII:** customer ids are replaced at parse time by `HMAC-SHA256(per-client salt, id)` (24 hex). Salt lives in `client_secrets`,
   admin-only via RLS. Names/addresses/phones are never read (no column mapping exists for them).
8. **Dispute submission is DB-enforced:** a CHECK forbids `submitted/accepted/rejected/escalated` without `submitted_by` + `screenshot_path`.
9. **Importer talks to an `ImportStore` interface** (Supabase impl + in-memory impl used by tests) so logic is tested without a DB.
   `SupabaseStore` is typechecked but **not yet exercised against a live project**.
10. **Row-level errors never throw:** bad rows go to `imports.unparsed`; missing *required columns* fail loudly with the list.
11. **Money is `number` in parsers (2 dp rounding), `numeric(12,2)` in DB.** Fine for < 1e9 €; fee math (Phase 3) will use integer cents.
12. **TypeScript pinned to 5.9**, not 7.x: Next 15 can't resolve tsconfig paths with the native TS 7 package.
13. **shadcn/ui deferred:** Phase 1 UI is plain Tailwind (one table). shadcn will be added when forms/dialogs arrive (Phase 2).
14. **`/deducciones` filters in JS** after fetching ≤2000 rows. Move to SQL/RPC when volume requires.
