-- pgTAP : lancer avec `supabase test db`
begin;
select plan(14);

create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin set local role authenticated; perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true); end $$;

-- Jeu de données (superuser) : U1 Prince, U2 Jordan (admins), U3 U4 U5 membres
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001','prince@t'), ('00000000-0000-0000-0000-000000000002','jordan@t'),
  ('00000000-0000-0000-0000-000000000003','m3@t'), ('00000000-0000-0000-0000-000000000004','m4@t'), ('00000000-0000-0000-0000-000000000005','m5@t');
insert into public.households (id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'T');
insert into public.household_members (household_id, user_id, role)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, case when email in ('prince@t','jordan@t') then 'admin'::public.member_role else 'member'::public.member_role end
from auth.users where email like '%@t';
insert into public.infractions (id, household_id, author_id, accused_id, room, description) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','kitchen','vaisselle');
insert into public.money_transfers (id, household_id, from_user, to_user, amount_minor, idempotency_key) values
  ('22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',20000,'k1');
insert into public.cleaning_assignments (id, household_id, title, assignee_id, due_on, status, created_by) values
  ('33333333-3333-3333-3333-333333333333','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Cuisine','00000000-0000-0000-0000-000000000003', current_date, 'to_verify','00000000-0000-0000-0000-000000000001');

-- Un membre ne peut pas sanctionner ni écrire directement des points
reset role; select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select throws_ok($$select public.rpc_decide_infraction('11111111-1111-1111-1111-111111111111', true, 20, 'x')$$, 'P0001', 'forbidden', 'un membre ne peut pas sanctionner');
select throws_ok($$insert into public.point_transactions (household_id,user_id,infraction_id,kind,delta,period,created_by) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','00000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','sanction',-20,'2026-01','00000000-0000-0000-0000-000000000003')$$, '42501', null, 'un membre ne peut pas écrire ses points');

-- Un admin : montant invalide refusé, 30 accepté
reset role; select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select throws_ok($$select public.rpc_decide_infraction('11111111-1111-1111-1111-111111111111', true, 40, 'x')$$, 'P0001', 'invalid_points', 'seuls 20/30/50 sont acceptés');
select lives_ok($$select public.rpc_decide_infraction('11111111-1111-1111-1111-111111111111', true, 30, 'preuve claire')$$, 'un admin valide une sanction');
select is((select sum(delta)::int from public.point_transactions where user_id = '00000000-0000-0000-0000-000000000004'), -30, 'le retrait est de 30 points');

-- Remise d'argent : seul le destinataire confirme
select throws_ok($$select public.rpc_resolve_transfer('22222222-2222-2222-2222-222222222222', true)$$, 'P0001', 'only_recipient_can_resolve', 'l''expéditeur ne peut pas confirmer');
reset role; select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select throws_ok($$select public.rpc_resolve_transfer('22222222-2222-2222-2222-222222222222', true)$$, 'P0001', 'only_recipient_can_resolve', 'un tiers ne peut pas confirmer');
reset role; select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select lives_ok($$select public.rpc_resolve_transfer('22222222-2222-2222-2222-222222222222', true)$$, 'le destinataire confirme');
reset role;
select throws_ok($$update public.money_transfers set amount_minor = 1 where id = '22222222-2222-2222-2222-222222222222'$$, 'P0001', 'confirmed_transfer_is_immutable', 'une remise confirmée est immuable');

-- Nettoyage : interdiction de valider sa propre tâche
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select throws_ok($$select public.rpc_verify_cleaning('33333333-3333-3333-3333-333333333333', true, null)$$, 'P0001', 'cannot_verify_own_task', 'pas d''auto-validation');
reset role; select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select lives_ok($$select public.rpc_verify_cleaning('33333333-3333-3333-3333-333333333333', true, null)$$, 'un autre membre valide');

-- Contestation tranchée à la majorité (3 sur 5)
reset role; select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select public.rpc_contest_infraction('11111111-1111-1111-1111-111111111111', 'injuste');
reset role; select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select public.rpc_cast_vote((select id from public.infraction_contests limit 1), 'overturn');
reset role; select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select public.rpc_cast_vote((select id from public.infraction_contests limit 1), 'overturn');
reset role; select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select is(public.rpc_cast_vote((select id from public.infraction_contests limit 1), 'overturn'), 'overturned', '3 voix sur 5 annulent la sanction');
select is((select sum(delta)::int from public.point_transactions where user_id = '00000000-0000-0000-0000-000000000004'), 0, 'les points sont rendus');

select * from finish();
rollback;
