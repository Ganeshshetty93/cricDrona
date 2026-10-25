-- Run in the SQL Editor of project qmtwnpusswddrblbdnbi.
-- Existing installation only. For a NEW empty database, run migrations/001_cricdrona.sql first.
-- Does not delete tables, users, events, registrations, or existing roles.
begin;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','user_roles','events','batches','registrations','contact_messages'] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Missing table public.%. Install the base schema before this repair.', table_name;
    end if;
  end loop;
end;
$$;

-- Auth owns email/password identities. Profiles contain application data only.
create or replace function public.handle_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text; v_phone text;
begin
  v_name := left(btrim(coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', 'Player')), 100);
  if char_length(v_name) < 2 then v_name := 'Player'; end if;
  v_phone := btrim(coalesce(new.raw_user_meta_data->>'phone', ''));
  if v_phone !~ '^[+0-9 ().-]{7,30}$' then v_phone := ''; end if;
  insert into public.profiles(id, name, email, phone)
    values(new.id, v_name, coalesce(new.email,''), v_phone)
    on conflict(id) do update set email = excluded.email;
  insert into public.user_roles(user_id,role) values(new.id,'player') on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.handle_auth_user() from public, anon, authenticated;

-- Restore missing application rows without changing any account's password or role.
insert into public.profiles(id, name, email, phone)
select id,
  case when char_length(btrim(coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', ''))) >= 2
    then left(btrim(coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name')),100) else 'Player' end,
  coalesce(email,''),
  case when btrim(coalesce(raw_user_meta_data->>'phone','')) ~ '^[+0-9 ().-]{7,30}$'
    then btrim(raw_user_meta_data->>'phone') else '' end
from auth.users on conflict(id) do nothing;
insert into public.user_roles(user_id,role)
select id,'player' from public.profiles on conflict(user_id) do nothing;

-- Ensure signup/email-change hooks exist without replacing working hooks.
do $$
begin
  if not exists(select 1 from pg_trigger where tgname='cricdrona_auth_created' and tgrelid='auth.users'::regclass and not tgisinternal) then
    create trigger cricdrona_auth_created after insert on auth.users for each row execute function public.handle_auth_user();
  end if;
  if not exists(select 1 from pg_trigger where tgname='cricdrona_auth_email_changed' and tgrelid='auth.users'::regclass and not tgisinternal) then
    create trigger cricdrona_auth_email_changed after update of email on auth.users for each row execute function public.handle_auth_user();
  end if;
end;
$$;
commit;

-- Account diagnostics: look in Authentication > Users AND public.profiles.
select u.id, u.email, u.email_confirmed_at is not null as activated,
  p.id is not null as has_profile, p.name, r.role
from auth.users u left join public.profiles p on p.id=u.id
left join public.user_roles r on r.user_id=u.id
where lower(u.email) in ('ganeshshetty93@gmail.com','ganeshshetty93+player@gmail.com');

select 'profiles' as table_name, count(*) as row_count from public.profiles
union all select 'user_roles',count(*) from public.user_roles
union all select 'events',count(*) from public.events
union all select 'batches',count(*) from public.batches
union all select 'registrations',count(*) from public.registrations
union all select 'contact_messages',count(*) from public.contact_messages;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('profiles','user_roles','events','batches','registrations','contact_messages');
