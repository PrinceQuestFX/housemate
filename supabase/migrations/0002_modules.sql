-- HOUSEMATE 0002 : signalements, dépenses, nettoyage, notifications, stockage, clôture mensuelle

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create function private.notify(p_user uuid, p_household uuid, p_kind text, p_payload jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, household_id, kind, payload) values (p_user, p_household, p_kind, p_payload);
$$;

-- ---------- Signalements ----------
create table public.infraction_evidence (
  id uuid primary key default gen_random_uuid(),
  infraction_id uuid not null references public.infractions(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.infraction_evidence (infraction_id);

create function private.create_infraction(p_household uuid, p_accused uuid, p_room text, p_description text, p_photo text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare i uuid; a record;
begin
  if not private.is_member(p_household) then raise exception 'forbidden'; end if;
  if p_accused is not null and not exists (select 1 from public.household_members where household_id = p_household and user_id = p_accused) then
    raise exception 'accused_not_member'; end if;
  insert into public.infractions (household_id, author_id, accused_id, room, description)
  values (p_household, auth.uid(), p_accused, p_room, p_description) returning id into i;
  if p_photo is not null then
    insert into public.infraction_evidence (infraction_id, storage_path, uploaded_by) values (i, p_photo, auth.uid());
  end if;
  for a in select user_id from public.household_members where household_id = p_household and role = 'admin' loop
    perform private.notify(a.user_id, p_household, 'infraction.reported', jsonb_build_object('infraction_id', i));
  end loop;
  return i;
end $$;

-- ---------- Dépenses ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  amount_minor bigint not null check (amount_minor > 0),
  category text not null check (category in ('groceries','water','electricity','internet','rent','cleaning','repairs','other')),
  spent_on date not null default current_date,
  paid_by uuid not null references auth.users(id),
  receipt_path text,
  idempotency_key text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.expenses (household_id, spent_on desc);

create table public.expense_shares (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  share_minor bigint not null check (share_minor >= 0),
  primary key (expense_id, user_id)
);
create index on public.expense_shares (user_id);

-- Répartition égale entre les membres concernés ; le reste de centimes va aux premiers.
create function private.create_expense(p_household uuid, p_title text, p_amount bigint, p_category text,
  p_date date, p_paid_by uuid, p_members uuid[], p_receipt text, p_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare e uuid; n int := cardinality(p_members); base bigint; rest bigint; i int;
begin
  if not private.is_member(p_household) then raise exception 'forbidden'; end if;
  if n is null or n = 0 then raise exception 'members_required'; end if;
  if (select count(*) from public.household_members where household_id = p_household
      and user_id = any (p_members || p_paid_by)) <> (select count(distinct x) from unnest(p_members || p_paid_by) x) then
    raise exception 'unknown_member'; end if;
  insert into public.expenses (household_id, title, amount_minor, category, spent_on, paid_by, receipt_path, idempotency_key, created_by)
  values (p_household, p_title, p_amount, p_category, p_date, p_paid_by, p_receipt, p_key, auth.uid())
  on conflict (idempotency_key) do nothing returning id into e;
  if e is null then select id into e from public.expenses where idempotency_key = p_key; return e; end if;
  base := p_amount / n; rest := p_amount - base * n;
  for i in 1..n loop
    insert into public.expense_shares values (e, p_members[i], base + case when i <= rest then 1 else 0 end);
  end loop;
  return e;
end $$;

create view public.member_balances with (security_invoker = true) as
select m.household_id, m.user_id,
  coalesce((select sum(e.amount_minor) from public.expenses e where e.household_id = m.household_id and e.paid_by = m.user_id), 0)
  - coalesce((select sum(s.share_minor) from public.expense_shares s join public.expenses e on e.id = s.expense_id
              where e.household_id = m.household_id and s.user_id = m.user_id), 0)
  + coalesce((select sum(t.amount_minor) from public.money_transfers t
              where t.household_id = m.household_id and t.from_user = m.user_id and t.status = 'confirmed'), 0)
  - coalesce((select sum(t.amount_minor) from public.money_transfers t
              where t.household_id = m.household_id and t.to_user = m.user_id and t.status = 'confirmed'), 0) as balance_minor
from public.household_members m;

-- ---------- Nettoyage ----------
create table public.cleaning_assignments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  room text,
  assignee_id uuid not null references auth.users(id),
  due_on date not null,
  status text not null default 'todo' check (status in ('todo','to_verify','to_fix','validated')),
  proof_path text,
  verifier_id uuid references auth.users(id),
  refusal_reason text,
  completed_at timestamptz,
  verified_at timestamptz,
  created_by uuid not null references auth.users(id),
  check (verifier_id is null or verifier_id <> assignee_id)
);
create index on public.cleaning_assignments (household_id, due_on);
create index on public.cleaning_assignments (assignee_id, status);

create function private.create_cleaning(p_household uuid, p_title text, p_room text, p_assignee uuid, p_due date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  if not private.is_admin(p_household) then raise exception 'forbidden'; end if;
  insert into public.cleaning_assignments (household_id, title, room, assignee_id, due_on, created_by)
  values (p_household, p_title, p_room, p_assignee, p_due, auth.uid()) returning id into c;
  perform private.notify(p_assignee, p_household, 'cleaning.assigned', jsonb_build_object('id', c));
  return c;
end $$;

create function private.complete_cleaning(p_id uuid, p_proof text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.cleaning_assignments; m record;
begin
  select * into c from public.cleaning_assignments where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if c.assignee_id <> auth.uid() then raise exception 'only_assignee'; end if;
  if c.status not in ('todo','to_fix') then raise exception 'invalid_state'; end if;
  update public.cleaning_assignments set status = 'to_verify', proof_path = coalesce(p_proof, proof_path),
    completed_at = now(), refusal_reason = null where id = c.id;
  for m in select user_id from public.household_members where household_id = c.household_id and user_id <> c.assignee_id loop
    perform private.notify(m.user_id, c.household_id, 'cleaning.to_verify', jsonb_build_object('id', c.id));
  end loop;
end $$;

create function private.verify_cleaning(p_id uuid, p_accept boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.cleaning_assignments;
begin
  select * into c from public.cleaning_assignments where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not private.is_member(c.household_id) then raise exception 'forbidden'; end if;
  if c.assignee_id = auth.uid() then raise exception 'cannot_verify_own_task'; end if;
  if c.status <> 'to_verify' then raise exception 'invalid_state'; end if;
  if not p_accept and coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  update public.cleaning_assignments set verifier_id = auth.uid(), verified_at = now(),
    status = case when p_accept then 'validated' else 'to_fix' end, refusal_reason = case when p_accept then null else p_reason end
  where id = c.id;
  perform private.notify(c.assignee_id, c.household_id,
    case when p_accept then 'cleaning.validated' else 'cleaning.refused' end, jsonb_build_object('id', c.id));
end $$;

-- ---------- Clôture mensuelle (idempotente ; ne touche jamais aux finances) ----------
create table public.monthly_scores (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  period text not null,
  final_score int not null,
  congratulated boolean not null default false,
  primary key (household_id, user_id, period)
);

create function private.close_month(p_household uuid, p_period text)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  insert into public.monthly_scores (household_id, user_id, period, final_score, congratulated)
  select m.household_id, m.user_id, p_period,
         200 + coalesce(sum(t.delta), 0)::int, coalesce(sum(t.delta), 0) = 0
  from public.household_members m
  left join public.point_transactions t on t.household_id = m.household_id and t.user_id = m.user_id and t.period = p_period
  where m.household_id = p_household group by m.household_id, m.user_id
  on conflict do nothing;
  for r in select user_id from public.monthly_scores
           where household_id = p_household and period = p_period and congratulated loop
    perform private.notify(r.user_id, p_household, 'month.congratulations', jsonb_build_object('period', p_period));
  end loop;
end $$;

create function private.close_previous_month() returns void
language plpgsql security definer set search_path = '' as $$
declare h record;
begin
  for h in select id from public.households loop
    perform private.close_month(h.id, private.period_of(h.id, now() - interval '1 month'));
  end loop;
end $$;

create extension if not exists pg_cron;
select cron.schedule('housemate-close-month', '5 0 1 * *', $$select private.close_previous_month()$$);

-- ---------- Enveloppes publiques ----------
create function public.rpc_create_infraction(p_household uuid, p_accused uuid, p_room text, p_description text, p_photo text)
returns uuid language sql security invoker as $$ select private.create_infraction(p_household, p_accused, p_room, p_description, p_photo) $$;
create function public.rpc_create_expense(p_household uuid, p_title text, p_amount bigint, p_category text, p_date date,
  p_paid_by uuid, p_members uuid[], p_receipt text, p_key text)
returns uuid language sql security invoker as $$ select private.create_expense(p_household, p_title, p_amount, p_category, p_date, p_paid_by, p_members, p_receipt, p_key) $$;
create function public.rpc_create_cleaning(p_household uuid, p_title text, p_room text, p_assignee uuid, p_due date)
returns uuid language sql security invoker as $$ select private.create_cleaning(p_household, p_title, p_room, p_assignee, p_due) $$;
create function public.rpc_complete_cleaning(p_id uuid, p_proof text)
returns void language sql security invoker as $$ select private.complete_cleaning(p_id, p_proof) $$;
create function public.rpc_verify_cleaning(p_id uuid, p_accept boolean, p_reason text)
returns void language sql security invoker as $$ select private.verify_cleaning(p_id, p_accept, p_reason) $$;

-- ---------- Droits, RLS, Realtime ----------
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function public.rpc_create_infraction(uuid, uuid, text, text, text),
  public.rpc_create_expense(uuid, text, bigint, text, date, uuid, uuid[], text, text),
  public.rpc_create_cleaning(uuid, text, text, uuid, date), public.rpc_complete_cleaning(uuid, text),
  public.rpc_verify_cleaning(uuid, boolean, text) to authenticated;

revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant update (first_name, last_name, phone, avatar_path) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter table public.notifications enable row level security;
alter table public.infraction_evidence enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.cleaning_assignments enable row level security;
alter table public.monthly_scores enable row level security;

create policy notif_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy evidence_read on public.infraction_evidence for select to authenticated using (
  exists (select 1 from public.infractions i where i.id = infraction_id and private.is_member(i.household_id)));
create policy expenses_read on public.expenses for select to authenticated using (private.is_member(household_id));
create policy shares_read on public.expense_shares for select to authenticated using (
  exists (select 1 from public.expenses e where e.id = expense_id and private.is_member(e.household_id)));
create policy cleaning_read on public.cleaning_assignments for select to authenticated using (private.is_member(household_id));
create policy scores_read on public.monthly_scores for select to authenticated using (private.is_member(household_id));

alter publication supabase_realtime add table public.notifications;

-- ---------- Stockage privé des preuves : evidence/<household_id>/<user_id>/<fichier> ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy evidence_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy evidence_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and private.is_member(((storage.foldername(name))[1])::uuid)
              and (storage.foldername(name))[2] = (select auth.uid())::text);
