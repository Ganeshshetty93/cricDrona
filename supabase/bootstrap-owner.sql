-- 1. Sign up and confirm the owner's email through the website first.
-- 2. Replace the email below, then run as postgres in Supabase SQL Editor.
-- This is an intentional one-time privileged operation, never exposed by the API.
do $$
declare v_user uuid;
begin
  select id into v_user from auth.users where lower(email)=lower('REPLACE_WITH_OWNER_EMAIL');
  if v_user is null then raise exception 'Create and confirm the owner account first, then replace the email in this script.'; end if;
  insert into public.user_roles(user_id,role) values(v_user,'owner')
    on conflict(user_id) do update set role='owner';
end;
$$;
