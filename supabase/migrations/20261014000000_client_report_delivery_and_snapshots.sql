begin;

alter table public.weekly_reports
  add column recipient_snapshot jsonb not null default '[]'::jsonb,
  add column provider_message_id text,
  add column send_source text,
  add column send_error text,
  add column send_state text not null default 'idle';

alter table public.weekly_reports
  add constraint weekly_reports_send_source_check
    check (send_source is null or send_source in ('manual', 'scheduled')),
  add constraint weekly_reports_send_state_check
    check (send_state in ('idle', 'sending', 'sent', 'failed', 'superseded'));

-- Preserve the latest existing sent report per client/period while marking
-- any earlier duplicate history rows as superseded before adding the guard.
with ranked as (
  select id, row_number() over (
    partition by client_id, period_start, period_end
    order by sent_at desc nulls last, created_at desc, id desc
  ) as position
  from public.weekly_reports
  where report_type = 'client' and status = 'sent' and client_id is not null
)
update public.weekly_reports wr
set send_state = case when ranked.position = 1 then 'sent' else 'superseded' end
from ranked
where wr.id = ranked.id;

create unique index weekly_reports_one_active_client_period_idx
  on public.weekly_reports (client_id, period_start, period_end)
  where report_type = 'client' and send_state in ('sending', 'sent');

create index weekly_reports_client_sent_at_idx
  on public.weekly_reports (client_id, sent_at desc);

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

create index weekly_report_projects_report_id_idx
  on public.weekly_report_projects (report_id);
create index weekly_report_projects_project_id_idx
  on public.weekly_report_projects (project_id);

create policy recipients_read_staff
  on public.client_recipients for select to authenticated
  using (public.current_profile_role() in ('admin', 'user'));

alter table public.weekly_report_projects enable row level security;

create policy report_projects_read_staff_or_assigned_guest
  on public.weekly_report_projects for select to authenticated
  using (
    public.current_profile_role() in ('admin', 'user')
    or (
      public.current_profile_role() = 'guest'
      and exists (
        select 1 from public.weekly_reports wr
        where wr.id = report_id
          and wr.client_id = public.current_profile_client_id()
          and wr.report_type = 'client'
      )
    )
  );

create policy report_projects_admin_manage
  on public.weekly_report_projects for all to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

revoke all on public.weekly_report_projects from anon, authenticated;
grant select, insert, update, delete on public.weekly_report_projects to authenticated;

-- Keep recipient email snapshots server-only. Authenticated clients may query
-- report metadata and client-scoped project snapshots, never recipient data.
revoke select on public.weekly_reports from authenticated;

grant select (
  id,
  client_id,
  report_type,
  period_start,
  period_end,
  recipient_count,
  project_count,
  status,
  sent_at,
  created_at,
  send_source
) on public.weekly_reports to authenticated;

commit;