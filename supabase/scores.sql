-- Stickflip global high scores (see SCOREBOARD in src/config.js).
-- Paste all of this into Supabase: SQL Editor -> New query -> Run.
-- Safe to run more than once.
--
-- The game only ever uses the public anon key. With row level security on,
-- that key can read the table and add rows, nothing else: no updates, no
-- deletes, no reading the hidden ip_hash column. Every new row is checked
-- (1-5 letters A-Z or spaces, a score from 1 to 100000) and rate limited.

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  initials text not null check (initials ~ '^[A-Z ]{1,5}$' and btrim(initials) <> ''),
  score integer not null check (score between 1 and 100000),
  created_at timestamptz not null default now(),
  ip_hash text
);

-- Names went from 4 letters to 5 (2026-11-16): widen the check on a table
-- made before then.
alter table public.scores drop constraint if exists scores_initials_check;
alter table public.scores add constraint scores_initials_check
  check (initials ~ '^[A-Z ]{1,5}$' and btrim(initials) <> '');

create index if not exists scores_top on public.scores (score desc, created_at);
create index if not exists scores_recent on public.scores (created_at desc);

alter table public.scores enable row level security;

drop policy if exists "anyone can read scores" on public.scores;
create policy "anyone can read scores" on public.scores
  for select to anon, authenticated using (true);

drop policy if exists "anyone can add a score" on public.scores;
create policy "anyone can add a score" on public.scores
  for insert to anon, authenticated with check (true);

-- Column-level grants: the game can read and write only these columns.
revoke all on public.scores from anon, authenticated;
grant select (id, initials, score, created_at) on public.scores to anon, authenticated;
grant insert (initials, score) on public.scores to anon, authenticated;

-- Rate limit: at most 3 scores a minute from one address, and 30 a minute
-- overall. The server fills in created_at and a hash of the address; the
-- address itself is never stored.
create or replace function public.scores_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  headers json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  addr text := btrim(split_part(coalesce(headers->>'x-forwarded-for', headers->>'x-real-ip', ''), ',', 1));
begin
  new.created_at := now();
  new.ip_hash := md5('stickflip:' || addr);
  if (select count(*) from public.scores
      where ip_hash = new.ip_hash and created_at > now() - interval '1 minute') >= 3 then
    raise exception 'Too many scores from you. Try again in a minute.';
  end if;
  if (select count(*) from public.scores where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many scores right now. Try again in a minute.';
  end if;
  return new;
end $$;

drop trigger if exists scores_before_insert on public.scores;
create trigger scores_before_insert before insert on public.scores
  for each row execute function public.scores_before_insert();
