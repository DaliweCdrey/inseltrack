begin;

do $$
begin
  if exists (
    select 1
    from public.client_recipients
    group by client_id, lower(btrim(email))
    having count(*) > 1
  ) then
    raise exception 'Duplicate recipient emails exist for a client. Resolve duplicate client_recipients rows before applying this migration.';
  end if;
end;
$$;

create unique index client_recipients_client_email_unique_idx
  on public.client_recipients (client_id, lower(btrim(email)));

commit;