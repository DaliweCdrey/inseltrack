create extension if not exists "pgcrypto";

create type public.project_status as enum ('not_started','in_progress','awaiting_feedback','completed','on_hold');
create type public.project_priority as enum ('low','normal','high','urgent');
create type public.report_type as enum ('client','internal');
create type public.report_status as enum ('draft','sent','failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'member',
  approved boolean default true,
  created_at timestamptz default now()
);

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
  description text,
  requested_by text,
  assigned_to text,
  deadline date,
  status public.project_status not null default 'not_started',
  priority public.project_priority not null default 'normal',
  latest_update text,
  next_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
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
  created_at timestamptz not null default now()
);

create index projects_client_id_idx on public.projects(client_id);
create index projects_status_idx on public.projects(status);
create index projects_deadline_idx on public.projects(deadline);
create index recipients_client_id_idx on public.client_recipients(client_id);
create index activities_project_id_idx on public.project_activities(project_id);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_recipients enable row level security;
alter table public.projects enable row level security;
alter table public.project_activities enable row level security;
alter table public.weekly_reports enable row level security;

create policy "authenticated users read clients" on public.clients for select to authenticated using (true);
create policy "authenticated users manage clients" on public.clients for all to authenticated using (true) with check (true);

create policy "authenticated users read recipients" on public.client_recipients for select to authenticated using (true);
create policy "authenticated users manage recipients" on public.client_recipients for all to authenticated using (true) with check (true);

create policy "authenticated users read projects" on public.projects for select to authenticated using (true);
create policy "authenticated users manage projects" on public.projects for all to authenticated using (true) with check (true);

create policy "authenticated users read activity" on public.project_activities for select to authenticated using (true);
create policy "authenticated users add activity" on public.project_activities for insert to authenticated with check (true);

create policy "authenticated users read reports" on public.weekly_reports for select to authenticated using (true);
create policy "authenticated users add reports" on public.weekly_reports for insert to authenticated with check (true);

create policy "user reads own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "user updates own profile" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.log_project_changes()
returns trigger
language plpgsql
security definer set search_path = public
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

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.project_activities(project_id, user_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'assignment_changed', old.assigned_to, new.assigned_to);
  end if;

  if old.deadline is distinct from new.deadline then
    insert into public.project_activities(project_id, user_id, action, old_value, new_value)
    values (new.id, auth.uid(), 'deadline_changed', old.deadline::text, new.deadline::text);
  end if;

  return new;
end;
$$;

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
