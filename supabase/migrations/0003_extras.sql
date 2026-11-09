-- HOUSEMATE 0003 : mur de la maison, notifications push, quota IA

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.announcements (household_id, pinned desc, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (user_id);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.ai_analyses (requested_by, created_at desc);

create function private.post_announcement(p_household uuid, p_title text, p_body text, p_pin boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a uuid;
begin
  if not private.is_member(p_household) then raise exception 'forbidden'; end if;
  insert into public.announcements (household_id, author_id, title, body, pinned)
  values (p_household, auth.uid(), p_title, coalesce(p_body, ''), coalesce(p_pin, false) and private.is_admin(p_household))
  returning id into a;
  return a;
end $$;

create function private.set_pinned(p_id uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.announcements set pinned = p_pinned where id = p_id and private.is_admin(household_id);
  if not found then raise exception 'forbidden'; end if;
end $$;

create function private.delete_announcement(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.announcements where id = p_id and (author_id = auth.uid() or private.is_admin(household_id));
  if not found then raise exception 'forbidden'; end if;
end $$;

create function private.save_push_subscription(p_endpoint text, p_p256dh text, p_auth_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth_key)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth_key = excluded.auth_key;
end $$;

-- Quota : 5 analyses IA par utilisateur et par tranche de 10 minutes.
create function private.reserve_ai_analysis(p_household uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member(p_household) then raise exception 'forbidden'; end if;
  if (select count(*) from public.ai_analyses where requested_by = auth.uid() and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'rate_limited';
  end if;
  insert into public.ai_analyses (household_id, requested_by) values (p_household, auth.uid());
end $$;

create function public.rpc_post_announcement(p_household uuid, p_title text, p_body text, p_pin boolean)
returns uuid language sql security invoker as $$ select private.post_announcement(p_household, p_title, p_body, p_pin) $$;
create function public.rpc_set_pinned(p_id uuid, p_pinned boolean)
returns void language sql security invoker as $$ select private.set_pinned(p_id, p_pinned) $$;
create function public.rpc_delete_announcement(p_id uuid)
returns void language sql security invoker as $$ select private.delete_announcement(p_id) $$;
create function public.rpc_save_push_subscription(p_endpoint text, p_p256dh text, p_auth_key text)
returns void language sql security invoker as $$ select private.save_push_subscription(p_endpoint, p_p256dh, p_auth_key) $$;
create function public.rpc_reserve_ai_analysis(p_household uuid)
returns void language sql security invoker as $$ select private.reserve_ai_analysis(p_household) $$;

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on function public.rpc_post_announcement(uuid, text, text, boolean), public.rpc_set_pinned(uuid, boolean),
  public.rpc_delete_announcement(uuid), public.rpc_save_push_subscription(text, text, text),
  public.rpc_reserve_ai_analysis(uuid) to authenticated;

revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant update (first_name, last_name, phone, avatar_path) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter table public.announcements enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.ai_analyses enable row level security;
create policy announcements_read on public.announcements for select to authenticated using (private.is_member(household_id));
create policy push_own on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy ai_own on public.ai_analyses for select to authenticated using (requested_by = (select auth.uid()));
