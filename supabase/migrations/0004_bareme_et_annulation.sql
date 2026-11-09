-- Nouveau barème de sanctions : 10, 15, 20, 30 points.
-- Les anciennes valeurs (20, 30, 50) restent tolérées dans le registre pour ne pas casser l'historique.

do $$
declare c record;
begin
  for c in
    select conrelid::regclass as t, conname from pg_constraint
    where contype = 'c' and (
      (conrelid = 'public.infractions'::regclass and pg_get_constraintdef(oid) like '%points%') or
      (conrelid = 'public.point_transactions'::regclass and pg_get_constraintdef(oid) like '%delta%'))
  loop
    execute format('alter table %s drop constraint %I', c.t, c.conname);
  end loop;
end $$;

alter table public.infractions
  add constraint infractions_points_check check (points in (10, 15, 20, 30, 50));
alter table public.point_transactions
  add constraint point_transactions_delta_check check (
    (kind = 'sanction' and delta in (-10, -15, -20, -30, -50)) or
    (kind = 'reversal' and delta in (10, 15, 20, 30, 50)));

create or replace function private.decide_infraction(p_id uuid, p_validate boolean, p_points int, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.infractions;
begin
  select * into v from public.infractions where id = p_id for update;
  if not found then raise exception 'infraction_not_found'; end if;
  if not private.is_admin(v.household_id) then raise exception 'forbidden'; end if;
  if v.status not in ('pending','reviewing') then raise exception 'already_decided'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;

  if p_validate then
    if p_points not in (10,15,20,30) then raise exception 'invalid_points'; end if;
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

-- Annulation par un admin : les points sont rendus (ligne inverse), la sanction passe en « annulée ».
-- Le registre reste append-only : rien n'est effacé, tout reste visible dans l'historique.
create function private.reverse_infraction(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.infractions; per text;
begin
  select * into v from public.infractions where id = p_id for update;
  if not found then raise exception 'infraction_not_found'; end if;
  if not private.is_admin(v.household_id) then raise exception 'forbidden'; end if;
  if v.status not in ('validated','contested') then raise exception 'not_reversible'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;

  select period into per from public.point_transactions where infraction_id = v.id and kind = 'sanction';
  update public.infraction_contests set outcome = 'overturned', closed_at = now()
    where infraction_id = v.id and outcome = 'open';
  update public.infractions set status = 'cancelled' where id = v.id;
  insert into public.point_transactions (household_id, user_id, infraction_id, kind, delta, period, reason, created_by)
  values (v.household_id, v.accused_id, v.id, 'reversal', v.points,
          coalesce(per, private.period_of(v.household_id, now())), p_reason, auth.uid());
  insert into public.activity_logs (household_id, actor_id, action, entity, entity_id, detail)
  values (v.household_id, auth.uid(), 'infraction.reversed', 'infraction', v.id,
          jsonb_build_object('points', v.points, 'reason', p_reason));
end $$;

create function public.rpc_reverse_infraction(p_id uuid, p_reason text)
returns void language sql security invoker as $$ select private.reverse_infraction(p_id, p_reason) $$;

revoke execute on function private.reverse_infraction(uuid, text), public.rpc_reverse_infraction(uuid, text) from public, anon;
grant execute on function private.reverse_infraction(uuid, text), public.rpc_reverse_infraction(uuid, text) to authenticated;
