-- KickIQ schema. Raw video is never stored; only scores, coaching text, metrics and (optional) score cards.
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  birth_year int,
  position text check (position in ('forward','midfielder','defender','goalkeeper','any')),
  level text check (level in ('beginner','club','academy')),
  weakness text check (weakness in ('power','accuracy','curve','consistency')),
  goal text check (goal in ('make_team','score_more','set_pieces','go_pro')),
  train_frequency text check (train_frequency in ('rarely','weekly','few_times','daily')),
  referral_code text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.analyses (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kick_type text not null check (kick_type in ('driven','curler','knuckleball','chip')),
  kick_rating int not null check (kick_rating between 0 and 100),
  sub_scores jsonb not null,
  one_fix text not null,
  why_it_matters text,
  drills jsonb not null,
  metrics jsonb,
  confidence real,
  source text check (source in ('camera','import')),
  retake_of_id text,
  score_card_url text,
  created_at timestamptz not null default now()
);
create index if not exists analyses_user_created_idx on public.analyses (user_id, created_at desc);

create table if not exists public.streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current int not null default 0,
  best int not null default 0,
  last_active timestamptz
);

-- Weekly challenge: first name + initial only, never a full name or handle.
create table if not exists public.challenge_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_key text not null,
  kick_type text not null,
  display_name text not null check (char_length(display_name) <= 24),
  score int not null check (score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, week_key, kick_type)
);
create index if not exists challenge_week_idx on public.challenge_entries (week_key, kick_type, score desc);

create table if not exists public.referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  redeemer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (redeemer_id)
);

-- Row-level security: users only touch their own rows.
alter table public.profiles enable row level security;
alter table public.analyses enable row level security;
alter table public.streaks enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.referral_redemptions enable row level security;

create policy "profiles self" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "analyses self" on public.analyses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "streaks self" on public.streaks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "challenge write self" on public.challenge_entries for insert with check (auth.uid() = user_id);
create policy "challenge update self" on public.challenge_entries for update using (auth.uid() = user_id);
create policy "challenge delete self" on public.challenge_entries for delete using (auth.uid() = user_id);
-- The leaderboard is readable by signed-in users, but only exposes display_name + score (see view below).
create policy "challenge read all" on public.challenge_entries for select using (auth.role() = 'authenticated');
create policy "redemptions self" on public.referral_redemptions for all using (auth.uid() = redeemer_id) with check (auth.uid() = redeemer_id);

create or replace view public.weekly_leaderboard as
  select week_key, kick_type, display_name, max(score) as score
  from public.challenge_entries
  group by week_key, kick_type, display_name, user_id
  order by score desc;

-- Redeem a referral code: validates the code belongs to another user and has not been used by the caller.
create or replace function public.redeem_referral(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
begin
  select id into owner_id from public.profiles where referral_code = upper(p_code);
  if owner_id is null then return 'invalid'; end if;
  if owner_id = auth.uid() then return 'own'; end if;
  if exists (select 1 from public.referral_redemptions where redeemer_id = auth.uid()) then return 'already'; end if;
  insert into public.referral_redemptions (code, redeemer_id) values (upper(p_code), auth.uid());
  return 'ok';
end $$;

-- Score cards (PNG) only. Private bucket; the owner may read/write their own folder.
insert into storage.buckets (id, name, public) values ('score-cards', 'score-cards', false)
  on conflict (id) do nothing;
create policy "score cards self" on storage.objects for all
  using (bucket_id = 'score-cards' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'score-cards' and auth.uid()::text = (storage.foldername(name))[1]);
