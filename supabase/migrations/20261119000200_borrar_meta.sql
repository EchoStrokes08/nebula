-- Borrar una meta con todo lo que se creó para ella, en una sola transacción.
-- Antes solo se borraba la meta: sus tareas y hábitos quedaban sueltos (goal_id = null) y
-- llenaban Hoy de trabajo de una meta que ya no existe. Ahora se borran también las tareas
-- (con subtareas, etiquetas y dependencias, por cascada) y los hábitos (con sus registros).
-- Se conservan los registros que son historia de la persona y no pertenecen a la meta:
-- sesiones de enfoque y entradas del diario quedan sin vínculo (on delete set null).
-- `security invoker`: RLS garantiza que solo se borra lo propio.
create or replace function public.delete_goal(p_goal_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tasks integer;
  v_habits integer;
begin
  if not exists (select 1 from public.goals where id = p_goal_id) then
    raise exception 'meta no encontrada' using errcode = 'P0002';
  end if;
  delete from public.tasks where goal_id = p_goal_id;
  get diagnostics v_tasks = row_count;
  delete from public.habits where goal_id = p_goal_id;
  get diagnostics v_habits = row_count;
  delete from public.goals where id = p_goal_id;
  return jsonb_build_object('tasks', v_tasks, 'habits', v_habits);
end;
$$;
revoke execute on function public.delete_goal(uuid) from public, anon;
grant execute on function public.delete_goal(uuid) to authenticated;
