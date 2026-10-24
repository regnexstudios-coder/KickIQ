-- Hardening from the Supabase advisors:
-- 1. auth.<fn>() wrapped in (select ...) so RLS evaluates it once per query, not per row.
-- 2. redeem_referral only callable by signed-in users, and refuses a null uid.

drop policy "profiles self" on public.profiles;
create policy "profiles self" on public.profiles for all
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy "analyses self" on public.analyses;
create policy "analyses self" on public.analyses for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "streaks self" on public.streaks;
create policy "streaks self" on public.streaks for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy "challenge write self" on public.challenge_entries;
create policy "challenge write self" on public.challenge_entries for insert
  with check ((select auth.uid()) = user_id);
drop policy "challenge update self" on public.challenge_entries;
create policy "challenge update self" on public.challenge_entries for update
  using ((select auth.uid()) = user_id);
drop policy "challenge delete self" on public.challenge_entries;
create policy "challenge delete self" on public.challenge_entries for delete
  using ((select auth.uid()) = user_id);
drop policy "challenge read all" on public.challenge_entries;
create policy "challenge read all" on public.challenge_entries for select
  using ((select auth.role()) = 'authenticated');

drop policy "redemptions self" on public.referral_redemptions;
create policy "redemptions self" on public.referral_redemptions for all
  using ((select auth.uid()) = redeemer_id) with check ((select auth.uid()) = redeemer_id);

drop policy "score cards self" on storage.objects;
create policy "score cards self" on storage.objects for all
  using (bucket_id = 'score-cards' and (select auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'score-cards' and (select auth.uid())::text = (storage.foldername(name))[1]);

create or replace function public.redeem_referral(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  caller uuid := auth.uid();
begin
  if caller is null then return 'invalid'; end if;
  select id into owner_id from public.profiles where referral_code = upper(p_code);
  if owner_id is null then return 'invalid'; end if;
  if owner_id = caller then return 'own'; end if;
  if exists (select 1 from public.referral_redemptions where redeemer_id = caller) then return 'already'; end if;
  insert into public.referral_redemptions (code, redeemer_id) values (upper(p_code), caller);
  return 'ok';
end $$;

revoke execute on function public.redeem_referral(text) from public, anon;
grant execute on function public.redeem_referral(text) to authenticated;
