-- 1) Sanctions validées par VOTE de la maison (plus par un admin seul) ; barème 5/10/15/20/30.
-- 2) Bonus : un membre demande des points pour une bonne action, les admins valident.

-- ---------- Barème et registre ----------
alter table public.infractions drop constraint if exists infractions_points_check;
alter table public.infractions add column proposed_points int check (proposed_points in (5, 10, 15, 20, 30));
alter table public.infractions add constraint infractions_points_check check (points in (5, 10, 15, 20, 30, 50));

create table public.bonus_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  requester_id uuid not null references auth.users(id),
  beneficiary_id uuid not null references auth.users(id),
  points int not null check (points in (5, 10, 15, 20, 30)),
  description text not null check (length(trim(description)) > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now()
);
create index on public.bonus_requests (household_id, status, created_at desc);

do $$
declare c record;
begin
  for c in select conname from pg_constraint
    where contype = 'c' and conrelid = 'public.point_transactions'::regclass
      and (pg_get_constraintdef(oid) like '%kind%' or pg_get_constraintdef(oid) like '%delta%')
  loop
    execute format('alter table public.point_transactions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.point_transactions alter column infraction_id drop not null;
alter table public.point_transactions add column bonus_id uuid references public.bonus_requests(id);
alter table public.point_transactions
  add constraint point_transactions_kind_check check (kind in ('sanction', 'reversal', 'bonus')),
  add constraint point_transactions_delta_check check (
    (kind = 'sanction' and delta in (-5, -10, -15, -20, -30, -50)) or
    (kind in ('reversal', 'bonus') and delta in (5, 10, 15, 20, 30, 50))),
  add constraint point_transactions_source_check check (
    (kind = 'bonus' and bonus_id is not null and infraction_id is null) or
    (kind <> 'bonus' and infraction_id is not null and bonus_id is null));
create unique index on public.point_transactions (bonus_id) where bonus_id is not null;

create table public.infraction_votes (
  infraction_id uuid not null references public.infractions(id) on delete cascade,
  voter_id uuid not null references auth.users(id),
  vote boolean not null, -- true = oui, false = non
  created_at timestamptz not null default now(),
  primary key (infraction_id, voter_id)
);

-- ---------- Droits et RLS ----------
alter table public.bonus_requests enable row level security;
alter table public.infraction_votes enable row level security;
revoke all on public.bonus_requests, public.infraction_votes from anon, authenticated;
grant select on public.bonus_requests, public.infraction_votes to authenticated;
create policy bonus_read on public.bonus_requests for select to authenticated using (private.is_member(household_id));
create policy infraction_votes_read on public.infraction_votes for select to authenticated using (
  exists (select 1 from public.infractions i where i.id = infraction_id and private.is_member(i.household_id)));

-- ---------- Signalement avec points proposés (le membre concerné est obligatoire) ----------
drop function public.rpc_create_infraction(uuid, uuid, text, text, text);
drop function private.create_infraction(uuid, uuid, text, text, text);

create function private.create_infraction(p_household uuid, p_accused uuid, p_room text, p_description text, p_photo text, p_points int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare i uuid; a record;
begin
  if not private.is_member(p_household) then raise exception 'forbidden'; end if;
  if p_points is null or p_points not in (5, 10, 15, 20, 30) then raise exception 'invalid_points'; end if;
  if p_accused is null or not exists (select 1 from public.household_members where household_id = p_household and user_id = p_accused) then
    raise exception 'accused_required'; end if;
  insert into public.infractions (household_id, author_id, accused_id, room, description, proposed_points)
  values (p_household, auth.uid(), p_accused, p_room, p_description, p_points) returning id into i;
  if p_photo is not null then
    insert into public.infraction_evidence (infraction_id, storage_path, uploaded_by) values (i, p_photo, auth.uid());
  end if;
  for a in select user_id from public.household_members
           where household_id = p_household and user_id <> auth.uid() and user_id <> p_accused loop
    perform private.notify(a.user_id, p_household, 'infraction.reported', jsonb_build_object('infraction_id', i));
  end loop;
  return i;
end $$;

-- ---------- Vote : majorité des membres hors personne concernée ----------
create function private.vote_infraction(p_id uuid, p_vote boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.infractions; n int; th int; yes int; no int;
begin
  select * into v from public.infractions where id = p_id for update;
  if not found then raise exception 'infraction_not_found'; end if;
  if not private.is_member(v.household_id) then raise exception 'forbidden'; end if;
  if v.status not in ('pending', 'reviewing') then raise exception 'already_decided'; end if;
  if v.accused_id = auth.uid() then raise exception 'accused_cannot_vote'; end if;

  insert into public.infraction_votes (infraction_id, voter_id, vote) values (v.id, auth.uid(), p_vote); -- un vote par membre

  select count(*) into n from public.household_members where household_id = v.household_id and user_id <> v.accused_id;
  th := n / 2 + 1;
  select count(*) filter (where vote), count(*) filter (where not vote) into yes, no
    from public.infraction_votes where infraction_id = v.id;

  if yes >= th then
    update public.infractions set status = 'validated', points = v.proposed_points, decided_at = now(), decision_reason = 'Validée par vote'
      where id = v.id;
    insert into public.point_transactions (household_id, user_id, infraction_id, kind, delta, period, reason, created_by)
    values (v.household_id, v.accused_id, v.id, 'sanction', -v.proposed_points,
            private.period_of(v.household_id, now()), 'Validée par vote', auth.uid());
    perform private.notify(v.accused_id, v.household_id, 'infraction.validated', jsonb_build_object('infraction_id', v.id));
    insert into public.activity_logs (household_id, actor_id, action, entity, entity_id, detail)
    values (v.household_id, auth.uid(), 'infraction.validated', 'infraction', v.id, jsonb_build_object('points', v.proposed_points, 'yes', yes, 'no', no));
    return 'validated';
  elsif no > n - th then
    update public.infractions set status = 'rejected', decided_at = now(), decision_reason = 'Rejetée par vote' where id = v.id;
    insert into public.activity_logs (household_id, actor_id, action, entity, entity_id, detail)
    values (v.household_id, auth.uid(), 'infraction.rejected', 'infraction', v.id, jsonb_build_object('yes', yes, 'no', no));
    return 'rejected';
  end if;
  return 'open';
end $$;

-- ---------- Bonus ----------
create function private.request_bonus(p_household uuid, p_beneficiary uuid, p_points int, p_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare b uuid; a record;
begin
  if not private.is_member(p_household) then raise exception 'forbidden'; end if;
  if p_points not in (5, 10, 15, 20, 30) then raise exception 'invalid_points'; end if;
  if not exists (select 1 from public.household_members where household_id = p_household and user_id = p_beneficiary) then
    raise exception 'beneficiary_not_member'; end if;
  insert into public.bonus_requests (household_id, requester_id, beneficiary_id, points, description)
  values (p_household, auth.uid(), p_beneficiary, p_points, p_description) returning id into b;
  for a in select user_id from public.household_members
           where household_id = p_household and role = 'admin' and user_id <> auth.uid() loop
    perform private.notify(a.user_id, p_household, 'bonus.requested', jsonb_build_object('bonus_id', b));
  end loop;
  return b;
end $$;

create function private.decide_bonus(p_id uuid, p_approve boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.bonus_requests;
begin
  select * into b from public.bonus_requests where id = p_id for update;
  if not found then raise exception 'bonus_not_found'; end if;
  if not private.is_admin(b.household_id) then raise exception 'forbidden'; end if;
  if b.status <> 'pending' then raise exception 'already_decided'; end if;
  if auth.uid() in (b.requester_id, b.beneficiary_id) then raise exception 'cannot_decide_own'; end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;

  update public.bonus_requests set status = case when p_approve then 'approved' else 'rejected' end,
    decided_by = auth.uid(), decided_at = now(), decision_reason = p_reason where id = b.id;
  if p_approve then
    insert into public.point_transactions (household_id, user_id, infraction_id, bonus_id, kind, delta, period, reason, created_by)
    values (b.household_id, b.beneficiary_id, null, b.id, 'bonus', b.points,
            private.period_of(b.household_id, now()), b.description, auth.uid());
  end if;
  perform private.notify(b.requester_id, b.household_id, 'bonus.decided', jsonb_build_object('bonus_id', b.id, 'approved', p_approve));
  if b.beneficiary_id <> b.requester_id then
    perform private.notify(b.beneficiary_id, b.household_id, 'bonus.decided', jsonb_build_object('bonus_id', b.id, 'approved', p_approve));
  end if;
  insert into public.activity_logs (household_id, actor_id, action, entity, entity_id, detail)
  values (b.household_id, auth.uid(), case when p_approve then 'bonus.approved' else 'bonus.rejected' end, 'bonus', b.id,
          jsonb_build_object('points', b.points, 'reason', p_reason));
end $$;

-- Un mois sans perte nette de points mérite les félicitations (les bonus ne l'empêchent pas).
create or replace function private.close_month(p_household uuid, p_period text)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  insert into public.monthly_scores (household_id, user_id, period, final_score, congratulated)
  select m.household_id, m.user_id, p_period,
         200 + coalesce(sum(t.delta), 0)::int, coalesce(sum(t.delta), 0) >= 0
  from public.household_members m
  left join public.point_transactions t on t.household_id = m.household_id and t.user_id = m.user_id and t.period = p_period
  where m.household_id = p_household group by m.household_id, m.user_id
  on conflict do nothing;
  for r in select user_id from public.monthly_scores
           where household_id = p_household and period = p_period and congratulated loop
    perform private.notify(r.user_id, p_household, 'month.congratulations', jsonb_build_object('period', p_period));
  end loop;
end $$;

-- ---------- Appels publics et droits ----------
create function public.rpc_create_infraction(p_household uuid, p_accused uuid, p_room text, p_description text, p_photo text, p_points int)
returns uuid language sql security invoker as $$ select private.create_infraction(p_household, p_accused, p_room, p_description, p_photo, p_points) $$;
create function public.rpc_vote_infraction(p_id uuid, p_vote boolean)
returns text language sql security invoker as $$ select private.vote_infraction(p_id, p_vote) $$;
create function public.rpc_request_bonus(p_household uuid, p_beneficiary uuid, p_points int, p_description text)
returns uuid language sql security invoker as $$ select private.request_bonus(p_household, p_beneficiary, p_points, p_description) $$;
create function public.rpc_decide_bonus(p_id uuid, p_approve boolean, p_reason text)
returns void language sql security invoker as $$ select private.decide_bonus(p_id, p_approve, p_reason) $$;

revoke execute on function
  private.create_infraction(uuid, uuid, text, text, text, int), private.vote_infraction(uuid, boolean),
  private.request_bonus(uuid, uuid, int, text), private.decide_bonus(uuid, boolean, text),
  public.rpc_create_infraction(uuid, uuid, text, text, text, int), public.rpc_vote_infraction(uuid, boolean),
  public.rpc_request_bonus(uuid, uuid, int, text), public.rpc_decide_bonus(uuid, boolean, text)
from public, anon;
grant execute on function
  private.create_infraction(uuid, uuid, text, text, text, int), private.vote_infraction(uuid, boolean),
  private.request_bonus(uuid, uuid, int, text), private.decide_bonus(uuid, boolean, text),
  public.rpc_create_infraction(uuid, uuid, text, text, text, int), public.rpc_vote_infraction(uuid, boolean),
  public.rpc_request_bonus(uuid, uuid, int, text), public.rpc_decide_bonus(uuid, boolean, text)
to authenticated;

-- La validation par un admin seul n'est plus possible.
revoke execute on function public.rpc_decide_infraction(uuid, boolean, int, text) from authenticated;
