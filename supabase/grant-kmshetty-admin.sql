-- Project: qmtwnpusswddrblbdnbi. Run in Supabase SQL Editor as postgres.
-- First register kmshetty@gmail.com, or use npm run account:repair to create it.
-- Grants admin access only to this account. Existing owner access is preserved.
-- Does not change passwords, authentication settings, or row-security policies.
begin;

do $$
declare account_id uuid; account_email text;
begin
  select id, email into account_id, account_email
  from auth.users where lower(email) = 'kmshetty@gmail.com';
  if account_id is null then
    raise exception 'Create kmshetty@gmail.com in Authentication > Users before running this script.';
  end if;

  insert into public.profiles(id, name, email)
    values (account_id, 'KM Shetty', account_email)
    on conflict (id) do update set email = excluded.email;
  insert into public.user_roles(user_id, role)
    values (account_id, 'admin')
    on conflict (user_id) do update set role = 'admin'
    where public.user_roles.role <> 'owner';
end;
$$;

select p.email, p.name, r.role,
  r.role in ('admin', 'owner') as has_admin_access,
  u.email_confirmed_at is not null as email_active
from public.profiles p
join public.user_roles r on r.user_id = p.id
join auth.users u on u.id = p.id
where lower(u.email) = 'kmshetty@gmail.com';
commit;
