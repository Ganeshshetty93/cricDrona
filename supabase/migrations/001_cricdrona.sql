-- Run once in a new Supabase project with the SQL editor or Supabase migrations.
-- Times are academy-local Asia/Kolkata; all audit timestamps are timestamptz.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Player' check (char_length(btrim(name)) between 2 and 100),
  email text not null check (char_length(email) <= 254),
  phone text not null default '' check (phone = '' or phone ~ '^[+0-9 ().-]{7,30}$'),
  dob date check (dob between date '1900-01-01' and current_date),
  playing_role text not null default '' check (char_length(playing_role) <= 80),
  interest text not null default '' check (char_length(interest) <= 80),
  created_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'player' check (role in ('player','coach','admin','owner'))
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  type text not null check (type in ('Match','Class')),
  ball text not null check (ball in ('Tennis ball','Hard ball')),
  age text not null check (age in ('Under 10','Under 12','Under 14','Under 16','Under 19','Adults','Open')),
  date date not null,
  time time not null,
  place text not null check (char_length(btrim(place)) between 3 and 200),
  fee numeric(10,2) not null default 0 check (fee between 0 and 1000000),
  seats integer not null check (seats between 1 and 10000),
  description text not null default '' check (char_length(description) <= 5000),
  status text not null default 'published' check (status in ('published','draft','cancelled')),
  created_at timestamptz not null default now()
);
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 120),
  coach text not null check (char_length(btrim(coach)) between 2 and 100),
  coach_id uuid references public.profiles(id) on delete set null,
  age text not null check (age in ('Under 10','Under 12','Under 14','Under 16','Under 19','Adults','Open')),
  ball text not null check (ball in ('Tennis ball','Hard ball')),
  schedule text not null check (char_length(btrim(schedule)) between 3 and 250),
  capacity integer not null check (capacity between 1 and 1000),
  created_at timestamptz not null default now()
);
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete restrict,
  batch_id uuid references public.batches(id) on delete set null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  email text not null check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  topic text not null check (char_length(btrim(topic)) between 3 and 100),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  status text not null default 'unread' check (status in ('unread','read')),
  created_at timestamptz not null default now()
);
create index events_date_idx on public.events(date, time);
create index registrations_event_idx on public.registrations(event_id, status);
create index registrations_batch_idx on public.registrations(batch_id, status);
create index registrations_user_idx on public.registrations(user_id);
create index batches_coach_idx on public.batches(coach_id);
create index contact_messages_user_date_idx on public.contact_messages(user_id, created_at);

create function public.current_app_role() returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select role from public.user_roles where user_id = (select auth.uid())), 'player');
$$;
create function public.is_academy_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_app_role() in ('admin','owner');
$$;
create function public.is_my_batch(p_batch_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.registrations where batch_id = p_batch_id and user_id = (select auth.uid()) and status = 'confirmed');
$$;
create function public.can_view_player(p_player_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select p_player_id = (select auth.uid()) or public.is_academy_admin() or (
    public.current_app_role() = 'coach' and exists (
      select 1 from public.registrations r join public.batches b on b.id = r.batch_id
      where r.user_id = p_player_id and r.status = 'confirmed' and b.coach_id = (select auth.uid())
    )
  );
$$;
create function public.can_view_event(p_event_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_academy_admin() or exists(
    select 1 from public.registrations r left join public.batches b on b.id = r.batch_id
    where r.event_id = p_event_id and (r.user_id = (select auth.uid()) or
      (public.current_app_role() = 'coach' and b.coach_id = (select auth.uid())))
  );
$$;
create function public.age_eligible(p_dob date, p_event_date date, p_category text) returns boolean language sql immutable set search_path = '' as $$
  select p_dob is not null and p_dob <= p_event_date and case p_category
    when 'Open' then true
    when 'Adults' then extract(year from age(p_event_date, p_dob)) >= 18
    when 'Under 10' then extract(year from age(p_event_date, p_dob)) < 10
    when 'Under 12' then extract(year from age(p_event_date, p_dob)) < 12
    when 'Under 14' then extract(year from age(p_event_date, p_dob)) < 14
    when 'Under 16' then extract(year from age(p_event_date, p_dob)) < 16
    when 'Under 19' then extract(year from age(p_event_date, p_dob)) < 19
    else false end;
$$;

create function public.handle_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  v_name := left(btrim(coalesce(new.raw_user_meta_data->>'name', 'Player')), 100);
  if char_length(v_name) < 2 then v_name := 'Player'; end if;
  insert into public.profiles(id,name,email) values(new.id,v_name,coalesce(new.email,''))
    on conflict(id) do update set email = excluded.email;
  insert into public.user_roles(user_id,role) values(new.id,'player') on conflict do nothing;
  return new;
end;
$$;
create trigger cricdrona_auth_created after insert on auth.users for each row execute function public.handle_auth_user();
create trigger cricdrona_auth_email_changed after update of email on auth.users for each row execute function public.handle_auth_user();
-- Accounts that existed before applying this migration start as players too.
insert into public.profiles(id,name,email) select id,'Player',coalesce(email,'') from auth.users on conflict do nothing;
insert into public.user_roles(user_id) select id from public.profiles on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.events enable row level security;
alter table public.batches enable row level security;
alter table public.registrations enable row level security;
alter table public.contact_messages enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (public.can_view_player(id));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_read on public.user_roles for select to authenticated using (user_id = (select auth.uid()) or public.is_academy_admin());
create policy events_read on public.events for select to anon,authenticated using (
  status = 'published' or public.can_view_event(id)
);
create policy events_insert_admin on public.events for insert to authenticated with check (public.is_academy_admin());
create policy events_update_admin on public.events for update to authenticated using (public.is_academy_admin()) with check (public.is_academy_admin());
create policy batches_read on public.batches for select to authenticated using (public.is_academy_admin() or (coach_id = (select auth.uid()) and public.current_app_role() = 'coach') or public.is_my_batch(id));
create policy batches_insert_admin on public.batches for insert to authenticated with check (public.is_academy_admin());
create policy batches_update_admin on public.batches for update to authenticated using (public.is_academy_admin()) with check (public.is_academy_admin());
create policy registrations_read on public.registrations for select to authenticated using (
  user_id = (select auth.uid()) or public.is_academy_admin() or (public.current_app_role() = 'coach' and exists(select 1 from public.batches where id = registrations.batch_id and coach_id = (select auth.uid())))
);
create policy messages_read_admin on public.contact_messages for select to authenticated using (public.is_academy_admin());
create policy messages_update_admin on public.contact_messages for update to authenticated using (public.is_academy_admin()) with check (public.is_academy_admin());

-- Direct writes to registrations, messages and roles are prohibited. RPCs below
-- enforce ownership, consent, capacity and role checks inside a transaction.
revoke all on public.profiles,public.user_roles,public.events,public.batches,public.registrations,public.contact_messages from anon,authenticated;
grant select on public.events to anon,authenticated;
grant select on public.profiles,public.user_roles,public.batches,public.registrations,public.contact_messages to authenticated;
grant update(name,phone,dob,playing_role,interest) on public.profiles to authenticated;
grant insert(title,type,ball,age,date,time,place,fee,seats,description,status), update(title,type,ball,age,date,time,place,fee,seats,description,status) on public.events to authenticated;
grant insert(name,coach,coach_id,age,ball,schedule,capacity), update(name,coach,coach_id,age,ball,schedule,capacity) on public.batches to authenticated;
grant update(status) on public.contact_messages to authenticated;

create function public.guard_event_changes() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if tg_op = 'UPDATE' then
    select count(*) into v_count from public.registrations where event_id = new.id and status = 'confirmed';
    if new.seats < v_count then raise exception 'CD_CAPACITY_TOO_SMALL'; end if;
    if v_count > 0 and (new.date,new.age,new.ball,new.type) is distinct from (old.date,old.age,old.ball,old.type) then raise exception 'CD_EVENT_LOCKED'; end if;
  end if;
  if new.status = 'published' and ((new.date + new.time) at time zone 'Asia/Kolkata') <= now() then
    if tg_op = 'INSERT' then raise exception 'CD_EVENT_STARTED';
    elsif (new.date,new.time,new.status) is distinct from (old.date,old.time,old.status) then raise exception 'CD_EVENT_STARTED'; end if;
  end if;
  return new;
end;
$$;
create trigger guard_event before insert or update on public.events for each row execute function public.guard_event_changes();
create function public.cancel_event_registrations() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.registrations set status = 'cancelled', batch_id = null where event_id = new.id and status = 'confirmed';
  end if;
  return new;
end;
$$;
create trigger cancel_event after update on public.events for each row execute function public.cancel_event_registrations();

create function public.guard_batch_changes() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if new.coach_id is not null and not exists(select 1 from public.user_roles where user_id = new.coach_id and role in ('coach','admin','owner')) then raise exception 'CD_BATCH_COACH'; end if;
  if tg_op = 'UPDATE' then
    select count(*) into v_count from public.registrations where batch_id = new.id and status = 'confirmed';
    if new.capacity < v_count then raise exception 'CD_CAPACITY_TOO_SMALL'; end if;
    if v_count > 0 and (new.age,new.ball) is distinct from (old.age,old.ball) then raise exception 'CD_BATCH_LOCKED'; end if;
  end if;
  return new;
end;
$$;
create trigger guard_batch before insert or update on public.batches for each row execute function public.guard_batch_changes();

create function public.guard_profile_dob() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.dob is distinct from old.dob and exists(
    select 1 from public.registrations r join public.events e on e.id = r.event_id
    left join public.batches b on b.id = r.batch_id
    where r.user_id = new.id and r.status = 'confirmed' and
      (not public.age_eligible(new.dob,e.date,e.age) or (b.id is not null and not public.age_eligible(new.dob,e.date,b.age)))
  ) then raise exception 'CD_AGE_INELIGIBLE'; end if;
  return new;
end;
$$;
create trigger guard_profile before update of dob on public.profiles for each row execute function public.guard_profile_dob();

create function public.list_events(p_include_drafts boolean default false) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_include_drafts and not public.is_academy_admin() then raise exception 'CD_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(item order by item->>'date',item->>'time') from (
    select to_jsonb(e) || jsonb_build_object('registered_count', (select count(*) from public.registrations r where r.event_id=e.id and r.status='confirmed')) as item
    from public.events e where p_include_drafts or e.status='published'
  ) rows),'[]'::jsonb);
end;
$$;
create function public.list_batches() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'CD_AUTH_REQUIRED'; end if;
  if public.current_app_role() not in ('owner','admin','coach') then raise exception 'CD_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(item order by item->>'name') from (
    select to_jsonb(b) || jsonb_build_object('registered_count',(select count(*) from public.registrations r where r.batch_id=b.id and r.status='confirmed')) as item
    from public.batches b where public.is_academy_admin() or b.coach_id=auth.uid()
  ) rows),'[]'::jsonb);
end;
$$;

create function public.register_for_event(p_event_id uuid,p_consent boolean) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_event public.events; v_profile public.profiles; v_id uuid;
begin
  if v_user is null then raise exception 'CD_AUTH_REQUIRED'; end if;
  if p_consent is distinct from true then raise exception 'CD_CONSENT_REQUIRED'; end if;
  -- Consistent lock order: profile, event, registration, batch. The event lock
  -- serializes capacity checks so concurrent final-seat requests cannot overbook.
  select * into v_profile from public.profiles where id=v_user for share;
  if v_profile.dob is null or char_length(btrim(v_profile.name)) < 2 then raise exception 'CD_PROFILE_INCOMPLETE'; end if;
  select * into v_event from public.events where id=p_event_id for update;
  if not found then raise exception 'CD_EVENT_NOT_FOUND'; end if;
  if v_event.status <> 'published' then raise exception 'CD_EVENT_UNAVAILABLE'; end if;
  if ((v_event.date+v_event.time) at time zone 'Asia/Kolkata') <= now() then raise exception 'CD_EVENT_STARTED'; end if;
  if not public.age_eligible(v_profile.dob,v_event.date,v_event.age) then raise exception 'CD_AGE_INELIGIBLE'; end if;
  if exists(select 1 from public.registrations where user_id=v_user and event_id=p_event_id and status='confirmed') then raise exception 'CD_ALREADY_REGISTERED'; end if;
  if (select count(*) from public.registrations where event_id=p_event_id and status='confirmed') >= v_event.seats then raise exception 'CD_EVENT_FULL'; end if;
  insert into public.registrations(user_id,event_id,consent_at) values(v_user,p_event_id,now())
    on conflict(user_id,event_id) do update set status='confirmed',batch_id=null,consent_at=now()
    returning id into v_id;
  return v_id;
end;
$$;
create function public.cancel_registration(p_registration_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_event_id uuid; v_event public.events; v_status text;
begin
  if auth.uid() is null then raise exception 'CD_AUTH_REQUIRED'; end if;
  select event_id into v_event_id from public.registrations where id=p_registration_id and user_id=auth.uid();
  if not found then raise exception 'CD_REGISTRATION_NOT_FOUND'; end if;
  select * into v_event from public.events where id=v_event_id for update;
  select status into v_status from public.registrations where id=p_registration_id and user_id=auth.uid() for update;
  if v_status = 'cancelled' then return; end if;
  if ((v_event.date+v_event.time) at time zone 'Asia/Kolkata') <= now() then raise exception 'CD_CANCELLATION_CLOSED'; end if;
  update public.registrations set status='cancelled',batch_id=null where id=p_registration_id and user_id=auth.uid();
end;
$$;
create function public.assign_registration_batch(p_registration_id uuid,p_batch_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_reg public.registrations; v_event public.events; v_batch public.batches; v_profile public.profiles;
begin
  if not public.is_academy_admin() then raise exception 'CD_FORBIDDEN'; end if;
  select * into v_reg from public.registrations where id=p_registration_id;
  if not found then raise exception 'CD_REGISTRATION_NOT_FOUND'; end if;
  select * into v_profile from public.profiles where id=v_reg.user_id for share;
  select * into v_event from public.events where id=v_reg.event_id for update;
  select * into v_reg from public.registrations where id=p_registration_id for update;
  if p_batch_id is null then update public.registrations set batch_id=null where id=p_registration_id; return; end if;
  if v_reg.status <> 'confirmed' or v_event.type <> 'Class' or v_event.status <> 'published' then raise exception 'CD_CLASS_REQUIRED'; end if;
  -- Lock both source and destination in ID order to avoid cross-batch deadlocks.
  perform 1 from public.batches where id in (p_batch_id,v_reg.batch_id) order by id for update;
  select * into v_batch from public.batches where id=p_batch_id;
  if not found then raise exception 'CD_BATCH_NOT_FOUND'; end if;
  if v_batch.ball <> v_event.ball or not public.age_eligible(v_profile.dob,v_event.date,v_batch.age) then raise exception 'CD_BATCH_MISMATCH'; end if;
  if (select count(*) from public.registrations where batch_id=p_batch_id and status='confirmed' and id<>p_registration_id) >= v_batch.capacity then raise exception 'CD_BATCH_FULL'; end if;
  update public.registrations set batch_id=p_batch_id where id=p_registration_id;
end;
$$;

create function public.submit_contact(p_name text,p_email text,p_topic text,p_message text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'CD_AUTH_REQUIRED'; end if;
  -- Per-user row lock makes the rate limit reliable across serverless instances.
  perform 1 from public.profiles where id=auth.uid() for update;
  if (select count(*) from public.contact_messages where user_id=auth.uid() and created_at > now()-interval '1 hour') >= 5 then raise exception 'CD_CONTACT_LIMIT'; end if;
  insert into public.contact_messages(user_id,name,email,topic,message)
    values(auth.uid(),btrim(p_name),lower(btrim(p_email)),btrim(p_topic),btrim(p_message)) returning id into v_id;
  return v_id;
end;
$$;
create function public.list_team() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_academy_admin() then raise exception 'CD_FORBIDDEN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'email',p.email,'role',r.role) order by p.name) from public.profiles p join public.user_roles r on r.user_id=p.id),'[]'::jsonb);
end;
$$;
create function public.set_user_role(p_email text,p_role text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_target uuid; v_old_role text;
begin
  if public.current_app_role() <> 'owner' then raise exception 'CD_FORBIDDEN'; end if;
  if p_role not in ('player','coach','admin') or p_role is null then raise exception 'CD_FORBIDDEN'; end if;
  select id into v_target from public.profiles where lower(email)=lower(btrim(p_email));
  if not found then raise exception 'CD_USER_NOT_FOUND'; end if;
  select role into v_old_role from public.user_roles where user_id=v_target for update;
  if v_target=auth.uid() or v_old_role='owner' then raise exception 'CD_OWNER_PROTECTED'; end if;
  update public.user_roles set role=p_role where user_id=v_target;
  return jsonb_build_object('id',v_target,'email',lower(btrim(p_email)),'role',p_role);
end;
$$;

-- PostgreSQL grants PUBLIC execute by default: remove it from every app function.
revoke all on function public.current_app_role(),public.is_academy_admin(),public.is_my_batch(uuid),public.can_view_player(uuid),public.can_view_event(uuid),public.age_eligible(date,date,text),public.handle_auth_user(),public.guard_event_changes(),public.cancel_event_registrations(),public.guard_batch_changes(),public.guard_profile_dob(),public.list_events(boolean),public.list_batches(),public.register_for_event(uuid,boolean),public.cancel_registration(uuid),public.assign_registration_batch(uuid,uuid),public.submit_contact(text,text,text,text),public.list_team(),public.set_user_role(text,text) from public,anon,authenticated;
grant execute on function public.current_app_role(),public.is_academy_admin(),public.can_view_event(uuid),public.list_events(boolean) to anon,authenticated;
grant execute on function public.is_my_batch(uuid),public.can_view_player(uuid),public.list_batches(),public.register_for_event(uuid,boolean),public.cancel_registration(uuid),public.assign_registration_batch(uuid,uuid),public.submit_contact(text,text,text,text),public.list_team(),public.set_user_role(text,text) to authenticated;

commit;
