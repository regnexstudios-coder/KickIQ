# Recobra

Pay-on-results recovery of money delivery platforms deduct from restaurant payouts. Internal back-office (Spanish UI).
Full brief: see the founder's v1 build brief. Tradeoffs: [docs/decisions.md](docs/decisions.md).

## Status: Phase 1 (in progress)

| Done | Not yet |
|---|---|
| Schema + RLS (`supabase/migrations/0001_init.sql`), validated on Postgres 16 | Applied to a real Recobra Supabase project |
| Parsers: Uber Eats (Order Errors, Payment Details, Order History), Glovo (orders, payout) — **synthetic fixtures only** | Verified against real exports |
| Deadline engine, idempotent importer, `pnpm import` CLI | CLI run against a live DB |
| `/deducciones` with filters + deadline badges, admin-only login | Evidence upload, AI, approval flow (Phase 2) |

## Setup
```bash
pnpm install
cp .env.example .env.local     # Recobra's OWN Supabase project (EU), not KickIQ's
# apply supabase/migrations/0001_init.sql, create your auth user, then:
#   insert into profiles (user_id, role) values ('<your auth uid>', 'admin');
#   insert into clients (name) values ('My restaurant') returning id;
pnpm test && pnpm typecheck
pnpm import path/to/export.csv --client <client-uuid>     # type auto-detected, or --type glovo_payout
pnpm dev                                                   # http://localhost:3000/deducciones
```
Report types: `ubereats_order_errors`, `ubereats_payment_details`, `ubereats_order_history`, `glovo_orders`, `glovo_payout`.
Import order tip: order history/orders export first, then errors/payout — either order works, data is merged.

## Layout
`lib/parsers/` one parser per report · `lib/import/` importer + stores · `lib/deadlines.ts` · `fixtures/` (synthetic) · `app/` admin UI
