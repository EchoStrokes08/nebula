-- Nebula · F08 (2/2) — Retos: duelos, grupales, cooperativos, equipos y pactos.
-- Reglas: docs/REGLAS_NEGOCIO.md §10. La puntuación se calcula SIEMPRE en el servidor a partir de
-- registros reales (sesiones de enfoque o registros del hábito vinculado). El cliente solo lee.

create type public.challenge_kind as enum ('duel', 'group', 'cooperative', 'team', 'pact');
create type public.challenge_metric as enum ('percent', 'consistency', 'sessions', 'quantity', 'relative');
create type public.challenge_source as enum ('focus', 'habit');
create type public.challenge_status as enum ('pending', 'active', 'finished', 'cancelled');
create type public.challenge_tie as enum ('shared', 'consistency');
create type public.coop_mode as enum ('collective', 'distributed');
create type public.participant_status as enum ('invited', 'accepted', 'declined', 'left');

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  kind public.challenge_kind not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text check (char_length(description) <= 500),
  circle_id uuid references public.circles (id) on delete set null,
  metric public.challenge_metric not null,
  source public.challenge_source not null,
  unit text not null check (char_length(unit) between 1 and 20),
  starts_on date not null,
  ends_on date not null,
  tz text not null default 'UTC',
  status public.challenge_status not null default 'pending',
  tie_rule public.challenge_tie not null default 'consistency',
  percent_cap numeric(5, 1) not null default 100 check (percent_cap between 100 and 200),
  min_daily numeric(10, 2) check (min_daily > 0),
  coop_mode public.coop_mode,
  coop_target numeric(12, 2) check (coop_target > 0),
  coop_min_each numeric(12, 2) check (coop_min_each > 0),
  pact_support text check (char_length(pact_support) <= 200),
  pact_celebration text check (char_length(pact_celebration) <= 200),
  outcome text check (outcome in ('achieved', 'not_achieved', 'completed')),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 366),
  check (kind <> 'cooperative' or (coop_mode is not null and coop_target is not null)),
  check (coop_mode <> 'distributed' or coop_min_each is not null),
  check (metric <> 'quantity' or kind in ('group', 'duel', 'team', 'cooperative'))
);
create index challenges_status_idx on public.challenges (status, ends_on);

create table public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  team smallint check (team in (1, 2)),
  status public.participant_status not null default 'invited',
  personal_target numeric(12, 2) check (personal_target > 0),
  habit_id uuid references public.habits (id) on delete set null,
  accepted_at timestamptz,
  primary key (challenge_id, user_id)
);
create index challenge_participants_user_idx on public.challenge_participants (user_id);

create table public.challenge_results (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  team smallint,
  rank integer not null,
  value numeric(14, 2) not null,
  score numeric(10, 2) not null,
  days_active integer not null,
  winner boolean not null default false,
  abandoned boolean not null default false,
  created_at timestamptz not null default now()
);
create index challenge_results_idx on public.challenge_results (challenge_id);

create table public.pact_confirmations (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  about_user uuid not null references public.profiles (id) on delete cascade,
  kept boolean not null,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id, about_user)
);

-- Utilidades -----------------------------------------------------------------------------------
create function public.is_participant(c uuid, u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenge_participants where challenge_id = c and user_id = u);
$$;

create function public.today_in(tz text, p_now timestamptz) returns date
language sql immutable set search_path = '' as $$ select (p_now at time zone tz)::date $$;

/** Ventana de gracia: los registros cuentan si se crearon como máximo 1 día después del fin. */
create function public.challenge_cutoff(c public.challenges) returns timestamptz
language sql immutable set search_path = '' as $$
  select ((c.ends_on + 2)::timestamp at time zone c.tz)
$$;

-- Valor de un participante (registros reales en la ventana del reto).
--  focus: minutos de sesiones de enfoque completadas (origen temporizador), sesión válida ≥ 10 min.
--  habit: registros del hábito vinculado; no cuentan los creados > 2 días después de su fecha
--         (sin retroactivos) ni después del corte; minutos por día limitados a 16 h.
create function public.participant_value(c public.challenges, u uuid, p_from date default null, p_to date default null)
returns table (value numeric, sessions integer, days_active integer, timer_value numeric)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  f date := coalesce(p_from, c.starts_on);
  t date := coalesce(p_to, c.ends_on);
  hid uuid;
  hkind public.habit_kind;
  cap numeric;
  cutoff timestamptz := public.challenge_cutoff(c);
begin
  if c.source = 'focus' then
    return query
      with per_day as (
        select (s.started_at at time zone c.tz)::date as d, least(sum(s.focused_seconds) / 60.0, 960) as minutes, count(*) filter (where s.focused_seconds >= 600) as n
        from public.focus_sessions s
        where s.user_id = u and s.status = 'completed' and s.ended_at is not null and s.created_at <= cutoff
          and (s.started_at at time zone c.tz)::date between f and t
        group by 1
      )
      select coalesce(sum(minutes), 0)::numeric, coalesce(sum(n), 0)::integer,
             count(*) filter (where minutes >= coalesce(c.min_daily, 1))::integer, coalesce(sum(minutes), 0)::numeric
      from per_day;
  else
    select p.habit_id into hid from public.challenge_participants p where p.challenge_id = c.id and p.user_id = u;
    select h.kind into hkind from public.habits h where h.id = hid and h.user_id = u;
    if hkind is null then
      return query select 0::numeric, 0, 0, 0::numeric;
      return;
    end if;
    cap := case when hkind in ('duration', 'flexible') then 960 when hkind in ('binary', 'frequency') then 50 else 100000 end;
    return query
      with valid as (
        select l.day_key, l.value, l.source
        from public.habit_logs l
        where l.habit_id = hid and l.user_id = u and l.day_key between f and t
          and l.created_at <= cutoff
          and l.created_at <= ((l.day_key + 3)::timestamp at time zone c.tz) -- sin retroactivos de más de 2 días
      ),
      per_day as (
        select day_key, least(sum(value), cap) as v, count(*) as n, least(sum(value) filter (where source = 'timer'), cap) as tv
        from valid group by day_key
      )
      select coalesce(sum(v), 0)::numeric, coalesce(sum(n), 0)::integer,
             count(*) filter (where v >= coalesce(c.min_daily, 0.01))::integer, coalesce(sum(tv), 0)::numeric
      from per_day;
  end if;
end;
$$;
revoke all on function public.participant_value(public.challenges, uuid, date, date) from public, anon, authenticated;

-- Clasificación calculada (usada por la UI y por el cierre).
create function public.compute_standings(p_challenge uuid, p_now timestamptz)
returns table (user_id uuid, team smallint, status public.participant_status, value numeric, target numeric, score numeric, sessions integer, days_active integer, timer_share numeric, rank integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare c public.challenges;
begin
  select * into c from public.challenges where id = p_challenge;
  return query
    with base as (
      select p.user_id, p.team, p.status, p.personal_target, v.value, v.sessions, v.days_active, v.timer_value,
             case when c.metric = 'relative' then (select b.value from public.participant_value(c, p.user_id, c.starts_on - (c.ends_on - c.starts_on + 1), c.starts_on - 1) b) end as baseline
      from public.challenge_participants p
      cross join lateral public.participant_value(c, p.user_id, c.starts_on, least(c.ends_on, public.today_in(c.tz, p_now))) v
      where p.challenge_id = c.id and p.status in ('accepted', 'left')
    ),
    scored as (
      select b.*,
        round(case c.metric
          when 'percent' then least(b.value / nullif(b.personal_target, 0) * 100, c.percent_cap)
          when 'consistency' then b.days_active
          when 'sessions' then b.sessions
          when 'quantity' then b.value
          when 'relative' then case when coalesce(b.baseline, 0) = 0 then case when b.value > 0 then 100 else 0 end else (b.value - b.baseline) / b.baseline * 100 end
        end, 2) as sc
      from base b
    )
    select s.user_id, s.team, s.status, round(s.value, 2), s.personal_target, coalesce(s.sc, 0),
           s.sessions, s.days_active, case when s.value > 0 then round(s.timer_value / s.value, 2) else 0 end,
           (rank() over (order by (s.status = 'accepted') desc, coalesce(s.sc, 0) desc,
                         case when c.tie_rule = 'consistency' then s.days_active else 0 end desc))::integer
    from scored s;
end;
$$;
revoke all on function public.compute_standings(uuid, timestamptz) from public, anon, authenticated;

-- Ciclo de vida -------------------------------------------------------------------------------------
create function public.challenge_refresh(p_challenge uuid, p_now timestamptz default now()) returns public.challenge_status
language plpgsql security definer set search_path = '' as $$
declare
  c public.challenges;
  today date;
  accepted integer;
  r record;
  coop_total numeric;
  achieved boolean;
begin
  select * into c from public.challenges where id = p_challenge for update;
  if not found then raise exception 'reto no encontrado'; end if;
  today := public.today_in(c.tz, p_now);

  if c.status = 'pending' and today >= c.starts_on then
    select count(*) into accepted from public.challenge_participants where challenge_id = c.id and status = 'accepted';
    update public.challenge_participants set status = 'declined' where challenge_id = c.id and status = 'invited';
    if accepted >= 2 then
      update public.challenges set status = 'active' where id = c.id;
      for r in select user_id from public.challenge_participants where challenge_id = c.id and status = 'accepted' loop
        perform public.notify(r.user_id, 'challenge_started', 'Empieza «' || c.title || '»', 'El reto ya está en marcha. Las reglas y objetivos quedan fijados.', jsonb_build_object('challenge_id', c.id));
      end loop;
      c.status := 'active';
    else
      update public.challenges set status = 'cancelled', finished_at = p_now where id = c.id;
      perform public.notify(c.created_by, 'challenge_cancelled', '«' || c.title || '» no empezó', 'No hubo suficientes participantes que aceptaran antes del inicio.', jsonb_build_object('challenge_id', c.id));
      return 'cancelled';
    end if;
  end if;

  if c.status = 'active' then
    -- Cooperativo: puede cerrarse antes si se alcanza el objetivo.
    if c.kind = 'cooperative' then
      select coalesce(sum(s.value), 0), bool_and(s.value >= coalesce(c.coop_min_each, 0)) into coop_total, achieved
      from public.compute_standings(c.id, p_now) s where s.status = 'accepted';
      achieved := coop_total >= c.coop_target and (c.coop_mode = 'collective' or achieved);
    end if;
    if p_now >= public.challenge_cutoff(c) or (c.kind = 'cooperative' and achieved) then
      insert into public.challenge_results (challenge_id, user_id, team, rank, value, score, days_active, winner, abandoned)
      select c.id, s.user_id, s.team, s.rank, s.value, s.score, s.days_active,
             c.kind not in ('cooperative', 'pact') and s.rank = 1 and s.status = 'accepted', s.status = 'left'
      from public.compute_standings(c.id, p_now) s;
      update public.challenges set status = 'finished', finished_at = p_now,
        outcome = case when c.kind = 'cooperative' then case when achieved then 'achieved' else 'not_achieved' end else 'completed' end
      where id = c.id;
      for r in select user_id from public.challenge_participants where challenge_id = c.id and status in ('accepted', 'left') loop
        perform public.notify(r.user_id, 'challenge_finished', 'Resultados de «' || c.title || '»',
          case when c.kind = 'cooperative' then case when achieved then '¡Objetivo conseguido en equipo!' else 'El objetivo no se alcanzó esta vez.' end
               when c.kind = 'pact' then 'El pacto ha terminado. Confirma cómo le fue a tu compañero.' else 'Mira la clasificación final.' end,
          jsonb_build_object('challenge_id', c.id));
      end loop;
      return 'finished';
    end if;
  end if;
  return (select status from public.challenges where id = c.id);
end;
$$;
revoke all on function public.challenge_refresh(uuid, timestamptz) from public, anon, authenticated;

/** Para tareas programadas: refresca todos los retos que puedan cambiar de estado. */
create function public.challenges_tick(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select id from public.challenges where status in ('pending', 'active') loop
    perform public.challenge_refresh(r.id, p_now);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.challenges_tick(timestamptz) from public, anon, authenticated;

-- API para el cliente -------------------------------------------------------------------------------
/**
 * Crea un reto. `p` (jsonb): kind, title, description, metric, source, unit, starts_on, ends_on, tz,
 * tie_rule, percent_cap, min_daily, coop_mode, coop_target, coop_min_each, pact_support,
 * pact_celebration, circle_id, invitees[] ({user_id, team}), my_target, my_habit_id, my_team.
 */
create function public.create_challenge(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  cid uuid;
  inv jsonb;
  invitee uuid;
  n_inv integer := jsonb_array_length(coalesce(p -> 'invitees', '[]'::jsonb));
  k public.challenge_kind := (p ->> 'kind')::public.challenge_kind;
  tz text := coalesce(p ->> 'tz', 'UTC');
begin
  if me is null then raise exception 'no autenticado'; end if;
  if (p ->> 'starts_on')::date < public.today_in(tz, now()) then raise exception 'el reto no puede empezar en el pasado'; end if;
  if k = 'duel' and n_inv <> 1 then raise exception 'un duelo es entre dos personas'; end if;
  if n_inv < 1 or n_inv > 30 then raise exception 'invita entre 1 y 30 personas'; end if;
  insert into public.challenges (created_by, kind, title, description, circle_id, metric, source, unit, starts_on, ends_on, tz, tie_rule, percent_cap, min_daily, coop_mode, coop_target, coop_min_each, pact_support, pact_celebration)
  values (me, k, btrim(p ->> 'title'), nullif(p ->> 'description', ''), nullif(p ->> 'circle_id', '')::uuid, (p ->> 'metric')::public.challenge_metric,
          (p ->> 'source')::public.challenge_source, p ->> 'unit', (p ->> 'starts_on')::date, (p ->> 'ends_on')::date, tz,
          coalesce(p ->> 'tie_rule', 'consistency')::public.challenge_tie, coalesce((p ->> 'percent_cap')::numeric, 100), nullif(p ->> 'min_daily', '')::numeric,
          nullif(p ->> 'coop_mode', '')::public.coop_mode, nullif(p ->> 'coop_target', '')::numeric, nullif(p ->> 'coop_min_each', '')::numeric,
          nullif(p ->> 'pact_support', ''), nullif(p ->> 'pact_celebration', ''))
  returning id into cid;
  -- El creador participa y acepta con su objetivo.
  insert into public.challenge_participants (challenge_id, user_id, team, status, accepted_at) values (cid, me, nullif(p ->> 'my_team', '')::smallint, 'invited', null);
  perform public.accept_challenge(cid, nullif(p ->> 'my_target', '')::numeric, nullif(p ->> 'my_habit_id', '')::uuid);
  for inv in select * from jsonb_array_elements(p -> 'invitees') loop
    invitee := (inv ->> 'user_id')::uuid;
    if invitee = me then continue; end if;
    if not public.are_friends(me, invitee) then raise exception 'solo puedes invitar a amigos'; end if;
    insert into public.challenge_participants (challenge_id, user_id, team) values (cid, invitee, nullif(inv ->> 'team', '')::smallint);
    perform public.notify(invitee, 'challenge_invite', public.display_name_of(me) || ' te reta', '«' || btrim(p ->> 'title') || '». Revisa las reglas y acepta antes de que empiece.', jsonb_build_object('challenge_id', cid));
  end loop;
  return cid;
end;
$$;

/** Aceptar: fija objetivo personal y fuente. Solo antes de que empiece; después queda bloqueado. */
create function public.accept_challenge(p_challenge uuid, p_target numeric default null, p_habit uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  c public.challenges;
begin
  select * into c from public.challenges where id = p_challenge;
  if not found or c.status <> 'pending' or public.today_in(c.tz, now()) > c.starts_on then raise exception 'el reto ya no admite cambios'; end if;
  if not exists (select 1 from public.challenge_participants where challenge_id = c.id and user_id = me and status in ('invited', 'accepted')) then raise exception 'no estás invitado'; end if;
  if c.metric in ('percent') or c.kind = 'pact' then
    if p_target is null or p_target <= 0 then raise exception 'define tu objetivo personal'; end if;
  end if;
  if c.source = 'habit' then
    if p_habit is null or not exists (select 1 from public.habits where id = p_habit and user_id = me) then raise exception 'elige uno de tus hábitos'; end if;
  end if;
  update public.challenge_participants set status = 'accepted', personal_target = p_target, habit_id = case when c.source = 'habit' then p_habit end, accepted_at = now()
  where challenge_id = c.id and user_id = me;
  if me <> c.created_by then
    perform public.notify(c.created_by, 'challenge_accepted', public.display_name_of(me) || ' aceptó', '«' || c.title || '»', jsonb_build_object('challenge_id', c.id));
  end if;
end;
$$;

create function public.decline_challenge(p_challenge uuid) returns void
language sql security definer set search_path = '' as $$
  update public.challenge_participants set status = 'declined' where challenge_id = p_challenge and user_id = (select auth.uid()) and status = 'invited';
$$;

/** Abandonar un reto activo: se conserva tu resultado marcado como abandonado. */
create function public.leave_challenge(p_challenge uuid) returns void
language sql security definer set search_path = '' as $$
  update public.challenge_participants set status = 'left' where challenge_id = p_challenge and user_id = (select auth.uid()) and status = 'accepted'
    and exists (select 1 from public.challenges where id = p_challenge and status = 'active');
$$;

create function public.cancel_challenge(p_challenge uuid) returns void
language sql security definer set search_path = '' as $$
  update public.challenges set status = 'cancelled', finished_at = now() where id = p_challenge and created_by = (select auth.uid()) and status = 'pending';
$$;

/** Clasificación para la UI: refresca el estado y devuelve los datos con nombres. Solo participantes. */
create function public.challenge_standings(p_challenge uuid)
returns table (user_id uuid, handle text, display_name text, team smallint, status public.participant_status, value numeric, target numeric, score numeric, sessions integer, days_active integer, timer_share numeric, rank integer)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_participant(p_challenge, (select auth.uid())) then raise exception 'no autorizado'; end if;
  perform public.challenge_refresh(p_challenge);
  return query
    select s.user_id, p.handle, p.display_name, s.team, s.status, s.value, s.target, s.score, s.sessions, s.days_active, s.timer_share, s.rank
    from public.compute_standings(p_challenge, now()) s join public.profiles p on p.id = s.user_id
    order by s.rank, p.display_name;
end;
$$;

/** Participantes con su estado (incluye invitados) para la vista de detalle. */
create function public.challenge_people(p_challenge uuid) returns table (user_id uuid, handle text, display_name text, team smallint, status public.participant_status, personal_target numeric)
language sql stable security definer set search_path = '' as $$
  select cp.user_id, p.handle, p.display_name, cp.team, cp.status, cp.personal_target
  from public.challenge_participants cp join public.profiles p on p.id = cp.user_id
  where cp.challenge_id = p_challenge and public.is_participant(p_challenge, (select auth.uid()))
  order by p.display_name;
$$;

create function public.confirm_pact(p_challenge uuid, p_about uuid, p_kept boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if not exists (select 1 from public.challenges where id = p_challenge and kind = 'pact' and status = 'finished') then raise exception 'el pacto no ha terminado'; end if;
  if p_about = me or not public.is_participant(p_challenge, me) or not public.is_participant(p_challenge, p_about) then raise exception 'no autorizado'; end if;
  insert into public.pact_confirmations (challenge_id, user_id, about_user, kept, note) values (p_challenge, me, p_about, p_kept, p_note)
  on conflict (challenge_id, user_id, about_user) do update set kept = excluded.kept, note = excluded.note, created_at = now();
end;
$$;

-- RLS: solo lectura para participantes; escrituras solo por funciones.
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_results enable row level security;
alter table public.pact_confirmations enable row level security;

create policy challenges_read on public.challenges for select to authenticated using (public.is_participant(id, (select auth.uid())));
create policy challenge_participants_read on public.challenge_participants for select to authenticated using (public.is_participant(challenge_id, (select auth.uid())));
create policy challenge_results_read on public.challenge_results for select to authenticated using (public.is_participant(challenge_id, (select auth.uid())));
create policy pact_confirmations_read on public.pact_confirmations for select to authenticated using (public.is_participant(challenge_id, (select auth.uid())));

revoke insert, update, delete on public.challenges, public.challenge_participants, public.challenge_results, public.pact_confirmations from authenticated;
revoke all on public.challenges, public.challenge_participants, public.challenge_results, public.pact_confirmations from anon;
revoke all on function public.create_challenge(jsonb), public.accept_challenge(uuid, numeric, uuid), public.decline_challenge(uuid), public.leave_challenge(uuid),
  public.cancel_challenge(uuid), public.challenge_standings(uuid), public.challenge_people(uuid), public.confirm_pact(uuid, uuid, boolean, text) from anon;

-- Cierre automático cada hora si pg_cron está disponible (Supabase); si no, el cierre ocurre al consultar.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('nebula-challenges-tick', '7 * * * *', 'select public.challenges_tick()');
  end if;
exception when others then
  raise notice 'pg_cron no disponible: los retos se cierran al consultarlos (%).', sqlerrm;
end;
$$;
