create extension if not exists "pgcrypto";

create type public.project_status as enum ('not_started','in_progress','awaiting_feedback','completed','on_hold');
create type public.project_priority as enum ('low','normal','high','urgent');
create type public.report_type as enum ('client','internal');
create type public.report_status as enum ('draft','sent','failed');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  industry text,
  is_active boolean not null default true,
  reporting_enabled boolean not null default false,
  reporting_day text not null default 'Friday',
  reporting_time time not null default '16:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'user' check (role in ('admin','user','guest')),
  client_id uuid references public.clients(id) on delete restrict,
  approved boolean not null default false,
  is_active boolean not null default true,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_role_client_check check (
    (role = 'guest' and client_id is not null)
    or (role in ('admin','user') and client_id is null)
  ),
  constraint profiles_rejected_not_approved_check check (rejected_at is null or approved = false)
);

create table public.client_recipients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  deadline date,
  status public.project_status not null default 'not_started',
  latest_update text,
  next_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.project_internal_details (
  project_id uuid primary key references public.projects(id) on delete cascade,
  assigned_to text,
  requested_by text,
  priority public.project_priority not null default 'normal',
  internal_notes text
);

create table public.project_activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  report_type public.report_type not null,
  period_start date not null,
  period_end date not null,
  recipient_count integer not null default 0,
  project_count integer not null default 0,
  status public.report_status not null default 'draft',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  recipient_snapshot jsonb not null default '[]'::jsonb,
  provider_message_id text,
  send_source text check (send_source is null or send_source in ('manual', 'scheduled')),
  send_error text,
  send_state text not null default 'idle' check (send_state in ('idle', 'sending', 'sent', 'failed', 'superseded'))
);

create table public.weekly_report_projects (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.weekly_reports(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  project_name_snapshot text not null,
  status_snapshot text not null,
  latest_update_snapshot text,
  next_step_snapshot text,
  deadline_snapshot date
);

create index projects_client_id_idx on public.projects(client_id);
create index projects_status_idx on public.projects(status);
create index projects_deadline_idx on public.projects(deadline);
create index recipients_client_id_idx on public.client_recipients(client_id);
create unique index client_recipients_client_email_unique_idx
  on public.client_recipients(client_id, lower(btrim(email)));
create index activities_project_id_idx on public.project_activities(project_id);
create index weekly_reports_client_sent_at_idx on public.weekly_reports(client_id, sent_at desc);
create unique index weekly_reports_one_active_client_period_idx
  on public.weekly_reports(client_id, period_start, period_end)
  where report_type = 'client' and send_state in ('sending', 'sent');
create index weekly_report_projects_report_id_idx on public.weekly_report_projects(report_id);
create index weekly_report_projects_project_id_idx on public.weekly_report_projects(project_id);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_recipients enable row level security;
alter table public.projects enable row level security;
alter table public.project_internal_details enable row level security;
alter table public.project_activities enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.weekly_report_projects enable row level security;

create or replace function public.current_profile_role()
returns text language sql stable security definer
set search_path = pg_catalog, public, auth
as $$ select p.role from public.profiles p where p.id = auth.uid() and p.approved = true and p.is_active = true and p.rejected_at is null limit 1 $$;

create or replace function public.current_profile_client_id()
returns uuid language sql stable security definer
set search_path = pg_catalog, public, auth
as $$ select p.client_id from public.profiles p where p.id = auth.uid() and p.approved = true and p.is_active = true and p.rejected_at is null and p.role = 'guest' limit 1 $$;

revoke all on function public.current_profile_role() from public, anon;
revoke all on function public.current_profile_client_id() from public, anon;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_profile_client_id() to authenticated;

create or replace function public.get_signup_clients()
returns table (id uuid, name text) language sql stable security definer
set search_path = pg_catalog, public
as $$ select c.id, c.name from public.clients c where c.is_active = true order by c.name $$;
revoke all on function public.get_signup_clients() from public;
grant execute on function public.get_signup_clients() to anon, authenticated;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id = auth.uid() or public.current_profile_role() = 'admin');

create policy clients_read_staff_or_assigned_guest on public.clients for select to authenticated
using (public.current_profile_role() in ('admin','user')
  or (public.current_profile_role() = 'guest' and id = public.current_profile_client_id()));
create policy clients_admin_manage on public.clients for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

create policy recipients_admin_manage on public.client_recipients for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');
create policy recipients_read_staff on public.client_recipients for select to authenticated
using (public.current_profile_role() in ('admin','user'));

create policy projects_read_staff_or_assigned_guest on public.projects for select to authenticated
using (public.current_profile_role() in ('admin','user')
  or (public.current_profile_role() = 'guest' and client_id = public.current_profile_client_id()));
create policy projects_admin_manage on public.projects for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');
create policy projects_user_insert on public.projects for insert to authenticated
with check (public.current_profile_role() = 'user');
create policy projects_user_update on public.projects for update to authenticated
using (public.current_profile_role() = 'user') with check (public.current_profile_role() = 'user');

create policy project_internal_details_staff_manage on public.project_internal_details for all to authenticated
using (public.current_profile_role() in ('admin','user'))
with check (public.current_profile_role() in ('admin','user'));

create policy activities_read_staff on public.project_activities for select to authenticated
using (public.current_profile_role() in ('admin','user'));
create policy activities_admin_manage on public.project_activities for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

create policy reports_read_staff_or_assigned_guest on public.weekly_reports for select to authenticated
using (public.current_profile_role() in ('admin','user')
  or (public.current_profile_role() = 'guest' and client_id = public.current_profile_client_id()));
create policy reports_admin_manage on public.weekly_reports for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');
create policy report_projects_read_staff_or_assigned_guest on public.weekly_report_projects for select to authenticated
using (public.current_profile_role() in ('admin','user')
  or (public.current_profile_role() = 'guest' and exists (
    select 1 from public.weekly_reports wr
    where wr.id = report_id and wr.client_id = public.current_profile_client_id() and wr.report_type = 'client'
  )));
create policy report_projects_admin_manage on public.weekly_report_projects for all to authenticated
using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

-- Grant table privileges explicitly; RLS policies further restrict each operation.
revoke all on public.profiles, public.clients, public.client_recipients,
  public.project_activities, public.weekly_reports
  from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.client_recipients to authenticated;
grant select, insert, update, delete on public.project_activities to authenticated;
grant select, insert, update, delete on public.weekly_reports to authenticated;
revoke select on public.weekly_reports from authenticated;
grant select (
  id, client_id, report_type, period_start, period_end, recipient_count,
  project_count, status, sent_at, created_at, provider_message_id,
  send_source, send_error
) on public.weekly_reports to authenticated;
grant select (send_state) on public.weekly_reports to service_role;
revoke all on public.weekly_report_projects from anon, authenticated;
grant select, insert, update, delete on public.weekly_report_projects to authenticated;

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

revoke all on public.project_internal_details from anon, authenticated;
grant select, insert, update, delete on public.project_internal_details to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = pg_catalog, public, auth
as $$
declare
  requested_type text := new.raw_user_meta_data->>'account_type';
  requested_client_id uuid;
  assigned_role text;
begin
  if requested_type = 'staff' then
    assigned_role := 'user';
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

create or replace function public.guard_profile_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if new.approved and new.role = 'guest' and not exists (
    select 1 from public.clients c where c.id = new.client_id and c.is_active = true
  ) then
    raise exception 'A guest must have an active client assigned before approval.';
  end if;
  if new.role in ('admin','user') and new.client_id is not null then
    raise exception 'Internal accounts cannot be assigned to a client.';
  end if;
  if new.rejected_at is not null and new.approved then
    raise exception 'A rejected account cannot be approved.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_profile_state() from public, anon, authenticated;
create trigger profiles_guard_state before insert or update on public.profiles
for each row execute function public.guard_profile_state();

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.log_project_changes()
returns trigger
language plpgsql
security definer set search_path = pg_catalog, public, auth
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

create trigger projects_activity_insert
after insert on public.projects
for each row execute procedure public.log_project_changes();

create trigger projects_activity_update
after update on public.projects
for each row execute procedure public.log_project_changes();

insert into public.clients (name, industry, reporting_enabled) values
('Ecobank','Banking and Financial Services',true),
('Shell','Energy and Retail',true),
('Uganda Airlines','Aviation',true),
('Ginny','FMCG',false),
('Nestlé','FMCG',false)
on conflict (name) do nothing;

revoke insert, update, delete on public.projects from anon, authenticated;
grant select on public.projects to authenticated;
grant insert (client_id, name, status, deadline, latest_update, next_step, completed_at, updated_at)
  on public.projects to authenticated;
grant update on public.projects to authenticated;
grant delete on public.projects to authenticated;

create or replace function public.guard_project_update()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if public.current_profile_role() = 'user'
     and (new.id is distinct from old.id or new.client_id is distinct from old.client_id
       or new.created_at is distinct from old.created_at) then
    raise exception 'Staff cannot change project identity or client ownership.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_project_update() from public, anon, authenticated;
create trigger projects_guard_update before update on public.projects
for each row execute function public.guard_project_update();
