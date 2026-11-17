-- Nebula · F04-001 — Hábitos, objetivos versionados, registros y pausas.
-- Reglas en docs/REGLAS_NEGOCIO.md §2–4. El progreso se calcula a partir de los registros
-- (src/domain/habits); no se guardan rachas ni porcentajes derivados.

create type public.habit_kind as enum ('binary', 'duration', 'quantity', 'frequency', 'cumulative', 'reduction', 'flexible');
create type public.habit_period as enum ('day', 'week', 'month');
create type public.habit_status as enum ('active', 'archived');
create type public.log_source as enum ('manual', 'timer', 'integration');

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (char_length(description) <= 500),
  category text check (char_length(category) <= 40),
  icon text not null default 'circle' check (icon ~ '^[a-z0-9-]{1,40}$'),
  color text not null default 'violet' check (color in ('violet', 'lavender', 'cyan', 'green', 'amber', 'rose', 'coral', 'sky')),
  kind public.habit_kind not null,
  unit text check (char_length(unit) <= 20),
  schedule_days smallint[] not null default '{}' check (schedule_days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  suggested_time time,
  start_day date not null default current_date,
  priority smallint not null default 2 check (priority between 1 and 3),
  visibility public.profile_visibility not null default 'private',
  status public.habit_status not null default 'active',
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Los tipos medidos en cantidad necesitan unidad.
  constraint habits_unit_required check (kind not in ('quantity', 'cumulative', 'reduction') or unit is not null)
);
create index habits_user_idx on public.habits (user_id, status, sort_order);
create trigger habits_touch before update on public.habits for each row execute function public.touch_updated_at();

-- Objetivos versionados: un cambio crea una versión nueva con `valid_from`; las antiguas no se editan.
create table public.habit_targets (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  valid_from date not null,
  period public.habit_period not null,
  target numeric(10, 2) not null check (target >= 0),
  session_min numeric(10, 2) check (session_min > 0),
  min_target numeric(10, 2) check (min_target > 0),
  created_at timestamptz not null default now(),
  unique (habit_id, valid_from)
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day_key date not null,
  value numeric(10, 2) not null check (value >= 0 and value <= 100000),
  note text check (char_length(note) <= 500),
  source public.log_source not null default 'manual',
  -- Idempotencia de la cola offline: reintentar el mismo registro no lo duplica.
  client_id uuid not null default gen_random_uuid(),
  logged_at timestamptz not null default now(),
  tz text not null default 'UTC' check (char_length(tz) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index habit_logs_habit_day_idx on public.habit_logs (habit_id, day_key);
create index habit_logs_user_day_idx on public.habit_logs (user_id, day_key);
create trigger habit_logs_touch before update on public.habit_logs for each row execute function public.touch_updated_at();

create table public.habit_pauses (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  from_day date not null,
  to_day date,
  created_at timestamptz not null default now(),
  check (to_day is null or to_day >= from_day)
);

-- Coherencia: el registro, el objetivo y la pausa deben pertenecer a un hábito del mismo usuario.
create function public.owns_habit(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.habits where id = h and user_id = (select auth.uid()));
$$;
revoke all on function public.owns_habit(uuid) from public;
grant execute on function public.owns_habit(uuid) to authenticated;

-- No se permite registrar en el futuro (más de un día de margen por zonas horarias) ni antes del inicio.
create function public.habit_logs_validate() returns trigger
language plpgsql set search_path = '' as $$
declare
  start_day date;
begin
  select h.start_day into start_day from public.habits h where h.id = new.habit_id;
  if new.day_key > (now() at time zone 'UTC')::date + 1 then
    raise exception 'habit_logs: no se puede registrar en el futuro' using errcode = 'check_violation';
  end if;
  if new.day_key < start_day then
    raise exception 'habit_logs: fecha anterior al inicio del hábito' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and (new.habit_id <> old.habit_id or new.user_id <> old.user_id) then
    raise exception 'habit_logs: no se puede mover un registro' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger habit_logs_validate before insert or update on public.habit_logs
  for each row execute function public.habit_logs_validate();

alter table public.habits enable row level security;
alter table public.habit_targets enable row level security;
alter table public.habit_logs enable row level security;
alter table public.habit_pauses enable row level security;

create policy habits_own on public.habits for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy habit_targets_select on public.habit_targets for select to authenticated using (public.owns_habit(habit_id));
create policy habit_targets_insert on public.habit_targets for insert to authenticated with check (public.owns_habit(habit_id));
-- Las versiones de objetivo son inmutables: sin update; solo se borran en cascada con el hábito.

create policy habit_logs_own on public.habit_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_habit(habit_id));

create policy habit_pauses_own on public.habit_pauses for all to authenticated
  using (public.owns_habit(habit_id)) with check (public.owns_habit(habit_id));

revoke all on public.habits, public.habit_targets, public.habit_logs, public.habit_pauses from anon;
revoke update, delete on public.habit_targets from authenticated;
