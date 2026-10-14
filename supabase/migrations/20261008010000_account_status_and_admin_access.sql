begin;

alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists rejected_at timestamptz;

-- A rejected profile is not an approved profile. Existing profiles retain their
-- approval state; newly registered profiles remain pending through the trigger.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_rejected_not_approved_check'
  ) then
    alter table public.profiles
      add constraint profiles_rejected_not_approved_check
      check (rejected_at is null or approved = false);
  end if;
end;
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.approved = true
    and p.is_active = true
    and p.rejected_at is null
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
  where p.id = auth.uid()
    and p.approved = true
    and p.is_active = true
    and p.rejected_at is null
    and p.role = 'guest'
  limit 1
$$;

-- Profile authorization fields may only be changed by trusted server code
-- using the service-role key after performing an explicit admin check.
drop policy if exists profiles_update_self_limited on public.profiles;
drop policy if exists profiles_admin_manage on public.profiles;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

create or replace function public.guard_profile_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if new.approved and new.role = 'guest' and not exists (
    select 1 from public.clients c
    where c.id = new.client_id and c.is_active = true
  ) then
    raise exception 'A guest must have an active client assigned before approval.';
  end if;

  if new.role in ('admin', 'user') and new.client_id is not null then
    raise exception 'Internal accounts cannot be assigned to a client.';
  end if;

  if new.rejected_at is not null and new.approved then
    raise exception 'A rejected account cannot be approved.';
  end if;

  return new;
end;
$$;
revoke all on function public.guard_profile_state() from public, anon, authenticated;
drop trigger if exists profiles_guard_state on public.profiles;
create trigger profiles_guard_state
before insert or update on public.profiles
for each row execute function public.guard_profile_state();

commit;
