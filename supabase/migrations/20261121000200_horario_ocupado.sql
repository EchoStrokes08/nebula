-- Disponibilidad descrita como «tu día» menos «cuando estás ocupado». Las franjas libres
-- (availability_windows) se siguen guardando ya calculadas: el planificador no cambia.

-- 1. Horas del día por día de la semana (sin fila = ese día no se planifica).
create table public.day_hours (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  primary key (user_id, weekday),
  check (end_time > start_time)
);
alter table public.day_hours enable row level security;
create policy day_hours_own on public.day_hours for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.day_hours from anon;

-- 2. Bloques ocupados que se repiten («Universidad», L–V 07:00–12:00).
create table public.busy_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index busy_blocks_user on public.busy_blocks(user_id);
alter table public.busy_blocks enable row level security;
create policy busy_blocks_own on public.busy_blocks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.busy_blocks from anon;

-- 3. Guardado atómico del horario y de las franjas libres resultantes (calculadas en el cliente).
create function public.save_schedule(p_days jsonb, p_busy jsonb, p_windows jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if jsonb_array_length(p_days) > 7 or jsonb_array_length(p_busy) > 50 or jsonb_array_length(p_windows) > 200 then
    raise exception 'schedule too large';
  end if;
  delete from public.day_hours where user_id = uid;
  delete from public.busy_blocks where user_id = uid;
  delete from public.availability_windows where user_id = uid;
  insert into public.day_hours (weekday, start_time, end_time)
    select (d->>'weekday')::smallint, (d->>'start')::time, (d->>'end')::time from jsonb_array_elements(p_days) d;
  insert into public.busy_blocks (label, weekdays, start_time, end_time)
    select b->>'label', array(select jsonb_array_elements_text(b->'weekdays')::smallint), (b->>'start')::time, (b->>'end')::time
    from jsonb_array_elements(p_busy) b;
  insert into public.availability_windows (weekday, start_time, end_time)
    select (w->>'weekday')::smallint, (w->>'start')::time, (w->>'end')::time from jsonb_array_elements(p_windows) w;
end $$;
revoke all on function public.save_schedule(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_schedule(jsonb, jsonb, jsonb) to authenticated;
