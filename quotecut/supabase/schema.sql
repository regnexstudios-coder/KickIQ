-- QuoteCut schema. Paste into Supabase Dashboard -> SQL Editor -> Run.
-- Safe to re-run (idempotent).

create extension if not exists "pgcrypto";

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       text unique,
  display_name text,
  tagline      text,
  currency     text not null default 'USD',
  rates        jsonb not null default
    '{"short_form":50,"long_form":150,"thumbnail":25,"rush_multiplier":1.3,"min_budget":100}'::jsonb,
  custom_notes text,
  plan         text not null default 'free' check (plan in ('free', 'pro')),
  created_at   timestamptz not null default now(),
  constraint handle_format check (handle is null or handle ~ '^[a-z0-9]{3,20}$')
);

create index if not exists profiles_handle_idx on public.profiles (handle);

-- ============================================================
-- quotes
-- ============================================================
create table if not exists public.quotes (
  id               uuid primary key default gen_random_uuid(),
  editor_id        uuid not null references public.profiles (id) on delete cascade,
  client_name      text not null,
  client_contact   text not null,
  project_summary  text not null,
  service_type     text not null check (service_type in ('short_form', 'long_form', 'thumbnail', 'bundle')),
  quantity         int  not null check (quantity > 0),
  is_rush          boolean not null default false,
  estimated_min    numeric not null,
  estimated_max    numeric not null,
  scope_breakdown  jsonb not null default '{}'::jsonb,
  chat_transcript  jsonb not null default '[]'::jsonb,
  status           text not null default 'new' check (status in ('new', 'accepted', 'archived')),
  created_at       timestamptz not null default now()
);

create index if not exists quotes_editor_created_idx on public.quotes (editor_id, created_at desc);
create index if not exists quotes_editor_status_idx  on public.quotes (editor_id, status);

-- ============================================================
-- Auto-create an (empty) profile whenever a user signs up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Helper: how many leads an editor received this calendar month.
-- SECURITY DEFINER so the public intake API (anon) can enforce the
-- free-tier cap without being able to read anyone's quotes.
-- ============================================================
create or replace function public.quotes_this_month(p_editor uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.quotes
  where editor_id = p_editor
    and created_at >= date_trunc('month', now());
$$;

revoke all on function public.quotes_this_month(uuid) from public;
grant execute on function public.quotes_this_month(uuid) to anon, authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.quotes   enable row level security;

-- profiles: anyone can read (public bio links resolve by handle)
drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

-- profiles: owner inserts / updates only their own row
drop policy if exists "owner inserts own profile" on public.profiles;
create policy "owner inserts own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "owner updates own profile" on public.profiles;
create policy "owner updates own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- quotes: anyone (the client, no account) can create a NEW lead for an existing editor
drop policy if exists "anyone can submit a quote" on public.quotes;
create policy "anyone can submit a quote"
  on public.quotes for insert
  to anon, authenticated
  with check (
    status = 'new'
    and exists (select 1 from public.profiles p where p.id = editor_id)
  );

-- quotes: only the owning editor can read / update them
drop policy if exists "owner reads own quotes" on public.quotes;
create policy "owner reads own quotes"
  on public.quotes for select
  to authenticated
  using (auth.uid() = editor_id);

drop policy if exists "owner updates own quotes" on public.quotes;
create policy "owner updates own quotes"
  on public.quotes for update
  to authenticated
  using (auth.uid() = editor_id)
  with check (auth.uid() = editor_id);

-- Column-level hardening: editors may only change `status` on a quote,
-- and may not change `plan` on their own profile (billing is server-managed).
revoke update on public.quotes   from authenticated;
grant  update (status)           on public.quotes to authenticated;

revoke update on public.profiles from authenticated;
grant  update (handle, display_name, tagline, currency, rates, custom_notes)
  on public.profiles to authenticated;
