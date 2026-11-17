-- Crear un hábito y su primer objetivo en una sola transacción.
-- Antes eran dos peticiones: si la segunda se cortaba (app cerrada, red), quedaba un hábito sin
-- objetivo que no se podía evaluar. `security invoker`: se aplican las mismas políticas RLS.
create or replace function public.create_habit(
  p_name text,
  p_kind public.habit_kind,
  p_period public.habit_period,
  p_target numeric,
  p_start_day date,
  p_description text default null,
  p_unit text default null,
  p_icon text default 'circle',
  p_color text default 'violet',
  p_schedule_days smallint[] default '{}',
  p_priority smallint default 2,
  p_suggested_time time default null,
  p_session_min numeric default null,
  p_min_target numeric default null,
  p_goal_id uuid default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.habits (name, description, kind, unit, icon, color, schedule_days, start_day, priority, suggested_time, sort_order, goal_id)
  values (p_name, p_description, p_kind, p_unit, p_icon, p_color, p_schedule_days, p_start_day, p_priority, p_suggested_time, extract(epoch from now()), p_goal_id)
  returning id into v_id;
  insert into public.habit_targets (habit_id, valid_from, period, target, session_min, min_target)
  values (v_id, p_start_day, p_period, p_target, p_session_min, p_min_target);
  return v_id;
end;
$$;
revoke execute on function public.create_habit(text, public.habit_kind, public.habit_period, numeric, date, text, text, text, text, smallint[], smallint, time, numeric, numeric, uuid) from public, anon;
grant execute on function public.create_habit(text, public.habit_kind, public.habit_period, numeric, date, text, text, text, text, smallint[], smallint, time, numeric, numeric, uuid) to authenticated;

-- Limpieza de datos dañados por el fallo anterior: hábitos sin ningún objetivo.
delete from public.habits h where not exists (select 1 from public.habit_targets t where t.habit_id = h.id);
