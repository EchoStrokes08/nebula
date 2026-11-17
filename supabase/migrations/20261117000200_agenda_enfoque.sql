-- Nebula · F06 — Agenda (eventos, disponibilidad), sesiones de enfoque y radar de distracciones.

create type public.event_source as enum ('manual', 'device_calendar', 'ics');
create type public.focus_mode as enum ('pomodoro', 'custom', 'long');
create type public.focus_status as enum ('active', 'completed', 'abandoned');
create type public.distraction_kind as enum ('notificaciones', 'redes', 'personas', 'ruido', 'cansancio', 'hambre', 'otra');

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  notes text check (char_length(notes) <= 2000),
  location text check (char_length(location) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  tz text not null default 'UTC' check (char_length(tz) <= 64),
  category text not null default 'personal' check (category in ('trabajo', 'estudio', 'personal', 'salud', 'social', 'otro')),
  recurrence text check (recurrence ~ '^FREQ=(DAILY|WEEKLY|MONTHLY)(;INTERVAL=[1-9][0-9]?)?(;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*)?$'),
  recurrence_until date,
  reminder_minutes integer check (reminder_minutes between 0 and 10080),
  -- Integraciones (F11): un evento importado nunca se presenta como propio ni se edita aquí.
  source public.event_source not null default 'manual',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_order check (ends_at > starts_at),
  constraint calendar_events_max_len check (ends_at - starts_at <= interval '14 days'),
  unique (user_id, source, external_id)
);
create index calendar_events_user_time_idx on public.calendar_events (user_id, starts_at);
create trigger calendar_events_touch before update on public.calendar_events for each row execute function public.touch_updated_at();

-- Franjas en las que el usuario está disponible para planificar (hora local de su zona).
create table public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index availability_user_idx on public.availability_windows (user_id, weekday);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  mode public.focus_mode not null,
  planned_minutes integer not null check (planned_minutes between 1 and 480),
  started_at timestamptz not null,
  ended_at timestamptz,
  focused_seconds integer not null default 0 check (focused_seconds >= 0),
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  status public.focus_status not null default 'active',
  ended_early boolean not null default false,
  habit_id uuid references public.habits (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  note text check (char_length(note) <= 500),
  client_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (user_id, client_id),
  -- El tiempo enfocado no puede superar el tiempo real transcurrido (integridad para retos).
  constraint focus_sessions_plausible check (ended_at is null or focused_seconds <= extract(epoch from (ended_at - started_at)) + 5),
  constraint focus_sessions_order check (ended_at is null or ended_at >= started_at)
);
create index focus_sessions_user_idx on public.focus_sessions (user_id, started_at);

create table public.distraction_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  session_id uuid references public.focus_sessions (id) on delete set null,
  kind public.distraction_kind not null,
  occurred_at timestamptz not null default now(),
  duration_minutes integer check (duration_minutes between 0 and 600),
  abandoned_session boolean not null default false,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index distraction_logs_user_idx on public.distraction_logs (user_id, occurred_at);

-- Vínculos de una sesión: solo hábitos/tareas propios.
create function public.focus_sessions_check_links() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.habit_id is not null and not exists (select 1 from public.habits h where h.id = new.habit_id and h.user_id = new.user_id) then
    raise exception 'hábito no válido' using errcode = 'check_violation';
  end if;
  if new.task_id is not null and not exists (select 1 from public.tasks t where t.id = new.task_id and t.user_id = new.user_id) then
    raise exception 'tarea no válida' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger focus_sessions_check_links before insert or update on public.focus_sessions for each row execute function public.focus_sessions_check_links();

create function public.distraction_logs_check_session() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.session_id is not null and not exists (select 1 from public.focus_sessions s where s.id = new.session_id and s.user_id = new.user_id) then
    raise exception 'sesión no válida' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger distraction_logs_check_session before insert or update on public.distraction_logs for each row execute function public.distraction_logs_check_session();

alter table public.calendar_events enable row level security;
alter table public.availability_windows enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.distraction_logs enable row level security;

create policy calendar_events_own on public.calendar_events for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy availability_own on public.availability_windows for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy focus_sessions_own on public.focus_sessions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy distraction_logs_own on public.distraction_logs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.calendar_events, public.availability_windows, public.focus_sessions, public.distraction_logs from anon;
