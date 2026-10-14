begin;

-- send_state is an operational lock used only by server-side report sending.
-- Do not grant it to authenticated: guest report readers must not see it.
grant select (send_state) on public.weekly_reports to service_role;

commit;