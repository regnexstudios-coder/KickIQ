-- Recobra v1 schema. EU region project. All money numeric(12,2).

create extension if not exists pgcrypto;

-- ───────── enums ─────────
create type platform as enum ('glovo', 'ubereats', 'justeat');
create type reason_code as enum ('missing_item', 'wrong_item', 'quality', 'late', 'cancelled', 'other');
create type dispute_status as enum ('draft', 'approved', 'submitted', 'accepted', 'rejected', 'escalated', 'expired');
create type evidence_type as enum ('pos_ticket', 'photo', 'timestamp', 'courier_log', 'other');
create type plan_type as enum ('single', 'group');
create type lang as enum ('es', 'ca', 'en');
create type app_role as enum ('admin', 'client');

-- ───────── core ─────────
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  cif text,
  contact_name text,
  email text,
  phone text,
  whatsapp text,
  fee_pct numeric(5,2) not null default 25 check (fee_pct between 0 and 100),
  plan plan_type not null default 'single',
  language lang not null default 'es',
  stripe_customer_id text,
  dpa_signed_at timestamptz,
  -- {"glovo": {"days": 45, "anchor": "deduction_date"}}; see lib/deadlines.ts
  deadline_overrides jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Per-client secret used to hash customer ids at parse time. Never exposed to the client role.
create table client_secrets (
  client_id uuid primary key references clients(id) on delete cascade,
  customer_salt text not null default encode(gen_random_bytes(32), 'hex')
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  address text,
  city text
);

create table platform_accounts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  platform platform not null,
  external_store_id text,
  staff_user_email text,
  invited_at timestamptz,
  status text not null default 'pending',
  unique (location_id, platform)
);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'client',
  client_id uuid references clients(id) on delete cascade,
  check (role = 'admin' or client_id is not null)
);

-- ───────── imports & data ─────────
create table imports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  platform platform not null,
  file_path text,                          -- storage path; raw file deleted after 90 days
  file_sha256 text not null,               -- same file twice = no-op
  report_type text not null,
  period_start timestamptz,
  period_end timestamptz,
  rows_parsed int not null default 0,
  rows_skipped int not null default 0,
  unparsed jsonb not null default '[]',
  imported_by text,
  raw_expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  unique (client_id, file_sha256)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  platform_account_id uuid not null references platform_accounts(id) on delete cascade,
  external_order_id text not null,
  ordered_at timestamptz,
  gross_amount numeric(12,2),
  items jsonb not null default '[]',
  courier_pickup_at timestamptz,
  status text,
  customer_hash text,                      -- HMAC(salt, customer id). No names/addresses/phones, ever.
  unique (platform_account_id, external_order_id)
);

create table deductions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  platform platform not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'EUR',
  reason_raw text not null default '',
  reason_code reason_code not null default 'other',
  deducted_at timestamptz,
  deadline_at timestamptz,
  disputable boolean,                      -- null = not yet classified
  disputable_reason text,
  pattern_flags text[] not null default '{}',
  source_import_id uuid references imports(id) on delete set null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (order_id, platform, reason_raw, amount, deducted_at)
);
create index on deductions (deadline_at);

create table evidence (
  id uuid primary key default gen_random_uuid(),
  deduction_id uuid not null references deductions(id) on delete cascade,
  type evidence_type not null,
  file_path text,
  note text,
  created_at timestamptz not null default now()
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  deduction_id uuid not null unique references deductions(id) on delete cascade,
  draft_text text,
  language lang not null default 'es',
  status dispute_status not null default 'draft',
  submitted_at timestamptz,
  submitted_by text,
  screenshot_path text,
  platform_response text,
  resolved_at timestamptz,
  recovered_amount numeric(12,2),
  -- a submission without a screenshot + actor is not allowed (compliance requirement)
  check (status not in ('submitted','accepted','rejected','escalated') or (submitted_by is not null and screenshot_path is not null))
);

-- Credits parsed from payout statements, kept so a later import can still match an earlier dispute.
create table payout_credits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  platform platform not null,
  external_order_id text,
  amount numeric(12,2) not null check (amount > 0),
  credited_at timestamptz,
  description_raw text not null default '',
  import_id uuid not null references imports(id) on delete cascade,
  matched_dispute_id uuid references disputes(id) on delete set null,
  unique nulls not distinct (client_id, platform, external_order_id, amount, credited_at, description_raw)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  period text not null,                    -- 'YYYY-MM'
  recovered_total numeric(12,2) not null,
  fee_pct numeric(5,2) not null,
  fee_amount numeric(12,2) not null,
  stripe_invoice_id text,
  status text not null default 'draft',
  unique (client_id, period)
);

create table recoveries (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  amount numeric(12,2) not null,
  seen_in_payout_import_id uuid references imports(id) on delete set null,
  recovered_at timestamptz not null default now(),
  billed boolean not null default false,
  invoice_id uuid references invoices(id) on delete set null,
  unique (dispute_id, seen_in_payout_import_id)
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor text not null,
  entity text not null,
  entity_id text not null,
  action text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);

create table ai_calls (
  id uuid primary key default gen_random_uuid(),
  fn text not null,                        -- classifyDeduction | draftDispute | detectPatterns
  prompt_version text not null,
  model text not null,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  deduction_id uuid references deductions(id) on delete set null,
  error text,
  created_at timestamptz not null default now()
);

-- ───────── RLS ─────────
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from profiles where user_id = auth.uid();
$$;

do $$
declare t text;
begin
  foreach t in array array['clients','client_secrets','locations','platform_accounts','profiles','imports','orders',
    'deductions','evidence','disputes','payout_credits','invoices','recoveries','audit_log','ai_calls']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Client role: read-only on its own rows (client_secrets, audit_log, ai_calls, profiles stay admin-only).
create policy client_read on clients for select to authenticated using (id = my_client_id());
create policy client_read on locations for select to authenticated using (client_id = my_client_id());
create policy client_read on platform_accounts for select to authenticated
  using (location_id in (select id from locations where client_id = my_client_id()));
create policy client_read on imports for select to authenticated using (client_id = my_client_id());
create policy client_read on orders for select to authenticated
  using (platform_account_id in (select pa.id from platform_accounts pa join locations l on l.id = pa.location_id where l.client_id = my_client_id()));
create policy client_read on deductions for select to authenticated
  using (order_id in (select o.id from orders o join platform_accounts pa on pa.id = o.platform_account_id join locations l on l.id = pa.location_id where l.client_id = my_client_id()));
create policy client_read on disputes for select to authenticated
  using (deduction_id in (select d.id from deductions d join orders o on o.id = d.order_id join platform_accounts pa on pa.id = o.platform_account_id join locations l on l.id = pa.location_id where l.client_id = my_client_id()));
create policy client_read on recoveries for select to authenticated using (client_id = my_client_id());
create policy client_read on invoices for select to authenticated using (client_id = my_client_id());
create policy own_profile on profiles for select to authenticated using (user_id = auth.uid());

-- ───────── storage (private buckets) ─────────
insert into storage.buckets (id, name, public) values
  ('imports', 'imports', false), ('evidence', 'evidence', false), ('screenshots', 'screenshots', false)
on conflict do nothing;

create policy admin_storage on storage.objects for all to authenticated
  using (bucket_id in ('imports','evidence','screenshots') and is_admin())
  with check (bucket_id in ('imports','evidence','screenshots') and is_admin());

-- ───────── retention: raw import files deleted after 90 days ─────────
-- Storage objects are removed by the nightly job in /app/api/cron (needs the storage API);
-- this view lists what is due.
create view imports_due_for_deletion with (security_invoker = true) as
  select id, file_path from imports where file_path is not null and raw_expires_at < now();
