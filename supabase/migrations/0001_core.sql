-- HOUSEMATE 0001 : coeur (identité, discipline, points, vote de contestation, remises d'argent)
-- Principe : les clients n'ecrivent jamais directement ; tout passe par des RPC transactionnelles.

create extension if not exists pgcrypto;
create schema if not exists private;

create type public.member_role as enum ('admin', 'member');
create type public.infraction_status as enum ('pending','reviewing','validated','rejected','contested','cancelled');
create type public.transfer_status as enum ('pending','confirmed','disputed','cancelled');

-- ---------- Identité ----------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Africa/Casablanca',
  currency text not null default 'MAD',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  avatar_path text,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members (user_id);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.activity_logs (household_id, created_at desc);

-- ---------- Helpers (hors schéma exposé) ----------
create function private.is_member(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members
                 where household_id = h and user_id = (select auth.uid()));
$$;

create function private.is_admin(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members
                 where household_id = h and user_id = (select auth.uid()) and role = 'admin');
$$;

create function private.period_of(h uuid, t timestamptz) returns text
language sql stable security definer set search_path = '' as $$
  select to_char(t at time zone (select timezone from public.households where id = h), 'YYYY-MM');
$$;

-- ---------- Discipline ----------
create table public.infractions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  accused_id uuid references auth.users(id),
  room text not null check (room in ('kitchen','living','toilets','bathroom','shower','hallway','other')),
  description text not null check (length(trim(description)) > 0),
  status public.infraction_status not null default 'pending',
  points int check (points in (20, 30, 50)),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now()
);
create index on public.infractions (household_id, status, created_at desc);
create index on public.infractions (accused_id);

-- Registre append-only : seule la correction par ligne inverse est possible.
create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  infraction_id uuid not null references public.infractions(id),
  kind text not null check (kind in ('sanction','reversal')),
  delta int not null check ((kind = 'sanction' and delta in (-20,-30,-50)) or (kind = 'reversal' and delta in (20,30,50))),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  reason text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (infraction_id, kind)
);
create index on public.point_transactions (household_id, user_id, period);

create function private.block_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'immutable_record'; end $$;

create trigger point_transactions_immutable
  before update or delete on public.point_transactions
  for each row execute function private.block_mutation();

-- Contestation tranchée par vote majoritaire de tous les membres.
create table public.infraction_contests (
  id uuid primary key default gen_random_uuid(),
  infraction_id uuid not null unique references public.infractions(id),
  household_id uuid not null references public.households(id) on delete cascade,
  contested_by uuid not null references auth.users(id),
  reason text not null check (length(trim(reason)) > 0),
  outcome text not null default 'open' check (outcome in ('open','upheld','overturned')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.contest_votes (
  contest_id uuid not null references public.infraction_contests(id) on delete cascade,
  voter_id uuid not null references auth.users(id),
  vote text not null check (vote in ('uphold','overturn')),
  created_at timestamptz not null default now(),
  primary key (contest_id, voter_id)
);

-- ---------- Remises d'argent (montants en centimes) ----------
create table public.money_transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  from_user uuid not null references auth.users(id),
  to_user uuid not null references auth.users(id),
  amount_minor bigint not null check (amount_minor > 0),
  status public.transfer_status not null default 'pending',
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_user <> to_user)
);
create index on public.money_transfers (household_id, status);

create function private.lock_confirmed_transfer() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'confirmed' then raise exception 'confirmed_transfer_is_immutable'; end if;
  if tg_op = 'DELETE' then raise exception 'transfers_cannot_be_deleted'; end if;
  return new;
end $$;

create trigger money_transfers_lock
  before update or delete on public.money_transfers
  for each row execute function private.lock_confirmed_transfer();

-- ---------- Fonctions métier (SECURITY DEFINER, schéma privé) ----------
create function private.decide_infraction(p_id uuid, p_validate boolean, p_points int, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.infractions;
begin
  select * into v from public.infractions where id = p_id for update;
  if not found then raise exception 'infraction_not_found'; end if;
  if not private.is_admin(v.household_id) then raise exception 'forbidden'; end if;
  if v.status not in ('pending','reviewing') then raise exception 'already_decided'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;

  if p_validate then
    if p_points not in (20,30,50) then raise exception 'invalid_points'; end if;
    if v.accused_id is null then raise exception 'accused_required'; end if;
    update public.infractions set status = 'validated', points = p_points,
      decided_by = auth.uid(), decided_at = now(), decision_reason = p_reason where id = v.id;
    insert into public.point_transactions (household_id, user_id, infraction_id, kind, delta, period, reason, created_by)
    values (v.household_id, v.accused_id, v.id, 'sanction', -p_points,
            private.period_of(v.household_id, now()), p_reason, auth.uid());
  else
    update public.infractions set status = 'rejected',
      decided_by = auth.uid(), decided_at = now(), decision_reason = p_reason where id = v.id;
  end if;

  insert into public.activity_logs (household_id, actor_id, action, entity, entity_id, detail)
  values (v.household_id, auth.uid(), case when p_validate then 'infraction.validated' else 'infraction.rejected' end,
          'infraction', v.id, jsonb_build_object('points', p_points, 'reason', p_reason));
end $$;

create function private.contest_infraction(p_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.infractions; c uuid;
begin
  select * into v from public.infractions where id = p_id for update;
  if not found then raise exception 'infraction_not_found'; end if;
  if v.accused_id is distinct from auth.uid() then raise exception 'only_sanctioned_member_can_contest'; end if;
  if v.status <> 'validated' then raise exception 'not_contestable'; end if;
  insert into public.infraction_contests (infraction_id, household_id, contested_by, reason)
  values (v.id, v.household_id, auth.uid(), p_reason) returning id into c;
  update public.infractions set status = 'contested' where id = v.id;
  return c;
end $$;

create function private.cast_vote(p_contest uuid, p_vote text)
returns text language plpgsql security definer set search_path = '' as $$
declare c public.infraction_contests; v public.infractions;
        n int; threshold int; up int; down int;
begin
  select * into c from public.infraction_contests where id = p_contest for update;
  if not found then raise exception 'contest_not_found'; end if;
  if not private.is_member(c.household_id) then raise exception 'forbidden'; end if;
  if c.outcome <> 'open' then raise exception 'contest_closed'; end if;
  if p_vote not in ('uphold','overturn') then raise exception 'invalid_vote'; end if;

  insert into public.contest_votes (contest_id, voter_id, vote) values (c.id, auth.uid(), p_vote); -- PK : un vote par membre

  select count(*) into n from public.household_members where household_id = c.household_id;
  threshold := n / 2 + 1;
  select count(*) filter (where vote = 'uphold'), count(*) filter (where vote = 'overturn')
    into up, down from public.contest_votes where contest_id = c.id;

  if up >= threshold then
    update public.infraction_contests set outcome = 'upheld', closed_at = now() where id = c.id;
    update public.infractions set status = 'validated' where id = c.infraction_id;
    return 'upheld';
  elsif down >= threshold then
    select * into v from public.infractions where id = c.infraction_id for update;
    update public.infraction_contests set outcome = 'overturned', closed_at = now() where id = c.id;
    update public.infractions set status = 'cancelled' where id = v.id;
    insert into public.point_transactions (household_id, user_id, infraction_id, kind, delta, period, reason, created_by)
    values (v.household_id, v.accused_id, v.id, 'reversal', v.points,
            private.period_of(v.household_id, now()), 'Sanction annulée par vote', auth.uid());
    return 'overturned';
  end if;
  return 'open';
end $$;

create function private.declare_transfer(p_household uuid, p_to uuid, p_amount bigint, p_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t uuid;
begin
  if not private.is_member(p_household) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.household_members where household_id = p_household and user_id = p_to) then
    raise exception 'recipient_not_member'; end if;
  insert into public.money_transfers (household_id, from_user, to_user, amount_minor, idempotency_key)
  values (p_household, auth.uid(), p_to, p_amount, p_key)
  on conflict (idempotency_key) do nothing returning id into t;
  if t is null then select id into t from public.money_transfers where idempotency_key = p_key and from_user = auth.uid(); end if;
  return t;
end $$;

create function private.resolve_transfer(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.money_transfers;
begin
  select * into t from public.money_transfers where id = p_id for update;
  if not found then raise exception 'transfer_not_found'; end if;
  if t.to_user <> auth.uid() then raise exception 'only_recipient_can_resolve'; end if;
  if t.status <> 'pending' then raise exception 'already_resolved'; end if;
  update public.money_transfers set status = case when p_accept then 'confirmed' else 'disputed' end::public.transfer_status,
    resolved_at = now() where id = t.id;
end $$;

-- ---------- Enveloppes publiques (SECURITY INVOKER) ----------
create function public.rpc_decide_infraction(p_id uuid, p_validate boolean, p_points int, p_reason text)
returns void language sql security invoker as $$ select private.decide_infraction(p_id, p_validate, p_points, p_reason) $$;
create function public.rpc_contest_infraction(p_id uuid, p_reason text)
returns uuid language sql security invoker as $$ select private.contest_infraction(p_id, p_reason) $$;
create function public.rpc_cast_vote(p_contest uuid, p_vote text)
returns text language sql security invoker as $$ select private.cast_vote(p_contest, p_vote) $$;
create function public.rpc_declare_transfer(p_household uuid, p_to uuid, p_amount bigint, p_key text)
returns uuid language sql security invoker as $$ select private.declare_transfer(p_household, p_to, p_amount, p_key) $$;
create function public.rpc_resolve_transfer(p_id uuid, p_accept boolean)
returns void language sql security invoker as $$ select private.resolve_transfer(p_id, p_accept) $$;

-- ---------- Droits ----------
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
grant execute on function public.rpc_decide_infraction(uuid, boolean, int, text),
                          public.rpc_contest_infraction(uuid, text),
                          public.rpc_cast_vote(uuid, text),
                          public.rpc_declare_transfer(uuid, uuid, bigint, text),
                          public.rpc_resolve_transfer(uuid, boolean) to authenticated;

revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant update (first_name, last_name, phone, avatar_path) on public.profiles to authenticated;

-- ---------- RLS ----------
alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.household_members enable row level security;
alter table public.activity_logs enable row level security;
alter table public.infractions enable row level security;
alter table public.point_transactions enable row level security;
alter table public.infraction_contests enable row level security;
alter table public.contest_votes enable row level security;
alter table public.money_transfers enable row level security;

create policy households_read on public.households for select to authenticated using (private.is_member(id));
create policy members_read on public.household_members for select to authenticated using (private.is_member(household_id));
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.household_members a join public.household_members b using (household_id)
    where a.user_id = (select auth.uid()) and b.user_id = profiles.id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy logs_admin_read on public.activity_logs for select to authenticated using (private.is_admin(household_id));
create policy infractions_read on public.infractions for select to authenticated using (private.is_member(household_id));
create policy points_read on public.point_transactions for select to authenticated using (private.is_member(household_id));
create policy contests_read on public.infraction_contests for select to authenticated using (private.is_member(household_id));
create policy votes_read on public.contest_votes for select to authenticated using (
  exists (select 1 from public.infraction_contests c where c.id = contest_id and private.is_member(c.household_id)));
create policy transfers_read on public.money_transfers for select to authenticated using (private.is_member(household_id));
