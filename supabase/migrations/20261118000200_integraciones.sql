create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('ics', 'device_calendar')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  last_imported_at timestamptz,
  unique(user_id, provider, name)
);
alter table public.integrations enable row level security;
create policy integrations_own on public.integrations for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.integrations from anon;
alter table public.calendar_events add column integration_id uuid references public.integrations(id) on delete cascade;
alter table public.calendar_events drop constraint calendar_events_user_id_source_external_id_key;
create unique index calendar_integration_external on public.calendar_events(integration_id, external_id) where integration_id is not null;
create function public.import_calendar(p_name text, p_provider text, p_events jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); integration uuid; e jsonb; n integer := 0;
begin
  if me is null then raise exception 'no autenticado'; end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 500 then raise exception 'eventos no válidos'; end if;
  insert into public.integrations(user_id, provider, name, last_imported_at) values(me, p_provider, p_name, now())
  on conflict(user_id, provider, name) do update set last_imported_at=now() returning id into integration;
  for e in select value from jsonb_array_elements(p_events) loop
    if char_length(e->>'external_id') not between 1 and 500 or e->>'external_id' is null then raise exception 'identificador no válido'; end if;
    insert into public.calendar_events(user_id, title, starts_at, ends_at, all_day, tz, source, integration_id, external_id)
    values(me, e->>'title', (e->>'starts_at')::timestamptz, (e->>'ends_at')::timestamptz, coalesce((e->>'all_day')::boolean, false), coalesce(e->>'tz', 'UTC'), p_provider::public.event_source, integration, e->>'external_id')
    on conflict(integration_id, external_id) where integration_id is not null do update
    set title=excluded.title, starts_at=excluded.starts_at, ends_at=excluded.ends_at, all_day=excluded.all_day, tz=excluded.tz;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.import_calendar(text, text, jsonb) from public, anon;
grant execute on function public.import_calendar(text, text, jsonb) to authenticated;

-- Evita vincular eventos a una integración de otra cuenta mediante la API de tablas.
drop policy calendar_events_own on public.calendar_events;
create policy calendar_events_own on public.calendar_events for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and
(integration_id is null or exists (select 1 from public.integrations i where i.id = integration_id and i.user_id = (select auth.uid()))));
