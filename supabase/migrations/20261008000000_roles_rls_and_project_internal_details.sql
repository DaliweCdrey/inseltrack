begin;

-- Preserve existing profile records and map the legacy role before constraining it.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists client_id uuid;
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;
update public.profiles
set role = case when role = 'admin' then 'admin' else 'user' end;
-- Require explicit reapproval after the permissions model changes.
update public.profiles set approved = false;
alter table public.profiles alter column role set default 'user';
alter table public.profiles alter column role set not null;
alter table public.profiles alter column approved set default false;
alter table public.profiles alter column approved set not null;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'user', 'guest')),
  add constraint profiles_role_client_check check (
    (role = 'guest' and client_id is not null)
    or (role in ('admin', 'user') and client_id is null)
  );
alter table public.profiles
  add constraint profiles_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete restrict;

-- Move non-client-facing fields before removing them from projects.
create table public.project_internal_details (
  project_id uuid primary key references public.projects(id) on delete cascade,
  assigned_to text,
  requested_by text,
  priority public.project_priority not null default 'normal',
  internal_notes text
);

insert into public.project_internal_details (project_id, assigned_to, requested_by, priority, internal_notes)
select id, assigned_to, requested_by, priority, description
from public.projects
on conflict (project_id) do update set
  assigned_to = excluded.assigned_to,
  requested_by = excluded.requested_by,
  priority = excluded.priority,
  internal_notes = excluded.internal_notes;

alter table public.projects
  drop column if exists assigned_to,
  drop column if exists requested_by,
  drop column if exists priority,
  drop column if exists description;

-- Profile lookup helpers bypass profile RLS only for the minimum required fields.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.approved = true
  limit 1
$$;

create or replace function public.current_profile_client_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select p.client_id
  from public.profiles p
  where p.id = auth.uid() and p.approved = true and p.role = 'guest'
  limit 1
$$;

revoke all on function public.current_profile_role() from public, anon;
revoke all on function public.current_profile_client_id() from public, anon;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_profile_client_id() to authenticated;

-- Expose only active client ids and names to the unauthenticated signup form.
create or replace function public.get_signup_clients()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select c.id, c.name from public.clients c where c.is_active = true order by c.name
$$;
revoke all on function public.get_signup_clients() from public;
grant execute on function public.get_signup_clients() to anon, authenticated;

-- Signup metadata is untrusted: it can request only staff or client status,
-- always starts unapproved, and can never create an administrator.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  requested_type text := new.raw_user_meta_data->>'account_type';
  requested_client_id uuid;
  assigned_role text;
begin
  if requested_type = 'staff' then
    assigned_role := 'user';
    requested_client_id := null;
  elsif requested_type = 'client' then
    assigned_role := 'guest';
    begin
      requested_client_id := (new.raw_user_meta_data->>'client_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'A valid client must be selected.';
    end;
    if requested_client_id is null or not exists (
      select 1 from public.clients c where c.id = requested_client_id and c.is_active = true
    ) then
      raise exception 'A valid active client must be selected.';
    end if;
  else
    raise exception 'Account type must be staff or client.';
  end if;

  insert into public.profiles (id, full_name, email, role, client_id, approved)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, assigned_role, requested_client_id, false);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Replace every prior policy on these tables; permissive policies are ORed together.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles', 'clients', 'client_recipients', 'projects',
        'project_internal_details', 'project_activities', 'weekly_reports'
      ])
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_recipients enable row level security;
alter table public.projects enable row level security;
alter table public.project_internal_details enable row level security;
alter table public.project_activities enable row level security;
alter table public.weekly_reports enable row level security;

create policy profiles_read_self_or_admin on public.profiles
for select to authenticated
using (id = auth.uid() or public.current_profile_role() = 'admin');
create policy profiles_update_self_limited on public.profiles
for update to authenticated
using (id = auth.uid() and approved = true)
with check (
  id = auth.uid()
  and role = public.current_profile_role()
  and approved = true
  and client_id is not distinct from public.current_profile_client_id()
);
create policy profiles_admin_manage on public.profiles
for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy clients_read_staff_or_assigned_guest on public.clients
for select to authenticated
using (
  public.current_profile_role() in ('admin', 'user')
  or (public.current_profile_role() = 'guest' and id = public.current_profile_client_id())
);
create policy clients_admin_manage on public.clients
for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy recipients_admin_manage on public.client_recipients
for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy projects_read_staff_or_assigned_guest on public.projects
for select to authenticated
using (
  public.current_profile_role() in ('admin', 'user')
  or (public.current_profile_role() = 'guest' and client_id = public.current_profile_client_id())
);
create policy projects_admin_manage on public.projects
for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');
create policy projects_user_insert on public.projects
for insert to authenticated
with check (public.current_profile_role() = 'user');
create policy projects_user_update on public.projects
for update to authenticated
using (public.current_profile_role() = 'user')
with check (public.current_profile_role() = 'user');

create policy project_internal_details_staff_manage on public.project_internal_details
for all to authenticated
using (public.current_profile_role() in ('admin', 'user'))
with check (public.current_profile_role() in ('admin', 'user'));

create policy activities_read_staff on public.project_activities
for select to authenticated
using (public.current_profile_role() in ('admin', 'user'));
create policy activities_admin_manage on public.project_activities
for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

create policy reports_read_staff_or_assigned_guest on public.weekly_reports
for select to authenticated
using (
  public.current_profile_role() in ('admin', 'user')
  or (public.current_profile_role() = 'guest' and client_id = public.current_profile_client_id())
);
create policy reports_admin_manage on public.weekly_reports
for all to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

-- Projects now contains only client-facing fields. Prevent staff from moving
-- a record between clients or altering its immutable identity/creation time.
revoke insert, update, delete on public.projects from anon, authenticated;
grant select on public.projects to authenticated;
grant insert (client_id, name, status, deadline, latest_update, next_step, completed_at, updated_at)
  on public.projects to authenticated;
grant update on public.projects to authenticated;
grant delete on public.projects to authenticated;

create or replace function public.guard_project_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if public.current_profile_role() = 'user'
     and (new.id is distinct from old.id
       or new.client_id is distinct from old.client_id
       or new.created_at is distinct from old.created_at) then
    raise exception 'Staff cannot change project identity or client ownership.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_project_update() from public, anon, authenticated;
drop trigger if exists projects_guard_update on public.projects;
create trigger projects_guard_update
before update on public.projects
for each row execute function public.guard_project_update();

-- A table privilege is shared by the authenticated database role; RLS with no
-- guest policy ensures guests receive no rows and cannot write these details.
revoke all on public.project_internal_details from anon, authenticated;
grant select, insert, update, delete on public.project_internal_details to authenticated;

-- Signup trigger function remains privileged but cannot accept a requested admin role.
-- Existing trigger is replaced in place by CREATE OR REPLACE FUNCTION above.

-- Activity logging must no longer reference fields moved off projects.
create or replace function public.log_project_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.project_activities(project_id, user_id, action, new_value)
    values (new.id, auth.uid(), 'project_created', new.name);
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.project_activities(project_id, user_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'status_changed', old.status::text, new.status::text);
  end if;
  if old.deadline is distinct from new.deadline then
    insert into public.project_activities(project_id, user_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'deadline_changed', old.deadline::text, new.deadline::text);
  end if;
  return new;
end;
$$;
revoke all on function public.log_project_changes() from public, anon, authenticated;

commit;
