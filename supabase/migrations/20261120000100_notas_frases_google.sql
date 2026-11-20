-- Notas rápidas tipo pósit, frases motivacionales propias, frase principal de Hoy
-- e importación de Google Calendar.

-- 1. Notas rápidas: texto con color, día y hora opcionales (recordatorio) y estado hecho.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 1000),
  color text not null default 'amarillo' check (color in ('amarillo', 'rosa', 'verde', 'azul', 'violeta', 'naranja')),
  day date,
  at_time time,
  remind boolean not null default false,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_time_needs_day check (at_time is null or day is not null),
  constraint notes_remind_needs_time check (not remind or at_time is not null)
);
create index notes_user_day on public.notes(user_id, done, day);
create trigger notes_touch before update on public.notes for each row execute function public.touch_updated_at();
alter table public.notes enable row level security;
create policy notes_own on public.notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.notes from anon;

-- 2. Frases propias para la sección de motivación.
create table public.motivation_phrases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 300),
  author text check (author is null or char_length(btrim(author)) between 1 and 80),
  created_at timestamptz not null default now()
);
create index motivation_phrases_user on public.motivation_phrases(user_id, created_at);
alter table public.motivation_phrases enable row level security;
create policy motivation_phrases_own on public.motivation_phrases for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.motivation_phrases from anon;

-- 3. Frase principal elegida para Hoy: «cita:<id>», «frase:<id>» o «propia:<uuid>».
alter table public.user_preferences add column featured_phrase text
  check (featured_phrase is null or featured_phrase ~ '^(cita|frase|propia):[A-Za-z0-9_-]{1,64}$');

-- 4. Google Calendar como proveedor de importación.
alter type public.event_source add value if not exists 'google';
alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check check (provider in ('ics', 'device_calendar', 'google'));

-- Tras sincronizar un rango, borra los eventos de esa integración que ya no existen en el origen.
create function public.prune_calendar(p_integration uuid, p_from timestamptz, p_to timestamptz, p_keep text[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); n integer;
begin
  if me is null then raise exception 'no autenticado'; end if;
  if not exists (select 1 from public.integrations i where i.id = p_integration and i.user_id = me) then
    raise exception 'integración no encontrada';
  end if;
  delete from public.calendar_events e
  where e.integration_id = p_integration and e.user_id = me
    and e.starts_at >= p_from and e.starts_at < p_to
    and not (e.external_id = any(coalesce(p_keep, '{}')));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.prune_calendar(uuid, timestamptz, timestamptz, text[]) from public, anon;
grant execute on function public.prune_calendar(uuid, timestamptz, timestamptz, text[]) to authenticated;
