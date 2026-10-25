-- Run once in this project's Supabase SQL Editor as the project administrator.
-- This grants the requested admin role. It does not change passwords or email verification.
begin;
do $$
declare account_id uuid;
begin
  select id into account_id from auth.users where lower(email) = 'ganeshshetty93@gmail.com';
  if account_id is null then
    raise exception 'Register ganeshshetty93@gmail.com before granting academy access.';
  end if;
  insert into public.user_roles(user_id, role) values (account_id, 'admin')
    on conflict (user_id) do update set role = 'admin';
end;
$$;
select p.email, r.role from public.profiles p join public.user_roles r on r.user_id = p.id
where lower(p.email) = 'ganeshshetty93@gmail.com';
commit;
