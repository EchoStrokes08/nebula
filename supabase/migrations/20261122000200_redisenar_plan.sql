alter table public.goals add column ai_plan_summary text check (char_length(ai_plan_summary) <= 5000);

create table public.goal_plan_revisions (
  id uuid primary key,
  goal_id uuid not null references public.goals(id) on delete cascade
);
alter table public.goal_plan_revisions enable row level security;
revoke all on public.goal_plan_revisions from anon, authenticated;
grant select, insert on public.goal_plan_revisions to authenticated;
create policy goal_plan_revisions_select on public.goal_plan_revisions for select to authenticated
  using (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()));
create policy goal_plan_revisions_insert on public.goal_plan_revisions for insert to authenticated
  with check (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()));

create function public.revise_goal_plan(
  p_goal uuid, p_revision uuid, p_version timestamptz, p_today date, p_summary text,
  p_milestones jsonb, p_tasks jsonb, p_habits jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_goal public.goals%rowtype;
  v_item jsonb;
  v_id uuid;
  v_order double precision;
  v_task_ids jsonb := '{}'::jsonb;
  v_dependency text;
  v_minutes integer;
begin
  select * into v_goal from public.goals where id = p_goal and user_id = auth.uid() for update;
  if not found then raise exception 'La meta ya no está disponible.'; end if;
  -- Si se perdió la respuesta tras guardar, el mismo intento devuelve éxito.
  if exists (select 1 from public.goal_plan_revisions where id = p_revision and goal_id = p_goal) then return; end if;
  if v_goal.status not in ('active', 'paused') or v_goal.updated_at is distinct from p_version then
    raise exception 'La meta cambió desde que se preparó la propuesta.';
  end if;
  if jsonb_array_length(p_milestones) > 12 or jsonb_array_length(p_tasks) > 24 or jsonb_array_length(p_habits) > 6 then
    raise exception 'La propuesta supera el tamaño permitido.';
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_order from public.milestones where goal_id = p_goal;
  for v_item in select value from jsonb_array_elements(p_milestones) loop
    v_id := (v_item->>'replaceId')::uuid;
    if v_id is null then
      insert into public.milestones (goal_id, title, due_date, sort_order)
      values (p_goal, v_item->>'title', (v_item->>'day')::date, v_order);
      v_order := v_order + 1;
    else
      update public.milestones set title = v_item->>'title', due_date = (v_item->>'day')::date
      where id = v_id and goal_id = p_goal and done_at is null and title = v_item->>'originalTitle'
        and due_date is not distinct from (v_item->>'originalVersion')::date;
      if not found then raise exception 'Un hito cambió desde que se preparó la propuesta.'; end if;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_tasks) loop
    v_id := (v_item->>'replaceId')::uuid;
    if v_id is null then
      insert into public.tasks (goal_id, title, notes, due_date, estimate_minutes, priority, sort_order)
      values (p_goal, v_item->>'title', v_item->>'notes', (v_item->>'day')::date, (v_item->>'minutes')::int,
              (v_item->>'priority')::smallint, extract(epoch from now()))
      returning id into v_id;
    else
      update public.tasks set title = v_item->>'title', notes = v_item->>'notes', due_date = (v_item->>'day')::date,
        estimate_minutes = (v_item->>'minutes')::int, priority = (v_item->>'priority')::smallint
      where id = v_id and goal_id = p_goal and user_id = auth.uid() and status = 'todo'
        and recurrence is null and scheduled_start is null and updated_at = (v_item->>'originalVersion')::timestamptz;
      if not found then raise exception 'Una tarea cambió desde que se preparó la propuesta.'; end if;
      perform 1 from public.subtasks where task_id = v_id for update;
      if exists (select 1 from public.subtasks where task_id = v_id and done) then
        raise exception 'Una tarea ya tiene subtareas completadas.';
      end if;
      delete from public.subtasks where task_id = v_id;
    end if;
    insert into public.subtasks (task_id, title, sort_order)
    select v_id, step.title, step.position - 1
    from jsonb_array_elements_text(v_item->'steps') with ordinality as step(title, position);

    for v_dependency in select value from jsonb_array_elements_text(v_item->'after') loop
      if v_task_ids ? v_dependency then
        insert into public.task_dependencies (task_id, depends_on)
        select v_id, (v_task_ids->>v_dependency)::uuid
        where not exists (select 1 from public.task_dependencies
          where task_id = v_id and depends_on = (v_task_ids->>v_dependency)::uuid);
      end if;
    end loop;
    v_task_ids := v_task_ids || jsonb_build_object(v_item->>'index', v_id);
  end loop;

  for v_item in select value from jsonb_array_elements(p_habits) loop
    v_id := (v_item->>'replaceId')::uuid;
    if v_id is null then
      v_minutes := (v_item->>'minutes')::int;
      perform public.create_habit(
        p_name => v_item->>'title',
        p_kind => (case when v_minutes is null then 'binary' else 'duration' end)::public.habit_kind,
        p_period => 'day',
        p_target => coalesce(v_minutes, 1),
        p_start_day => p_today,
        p_description => v_item->>'notes',
        p_unit => case when v_minutes is not null then 'min' end,
        p_icon => 'book-open',
        p_schedule_days => array(select value::smallint from jsonb_array_elements_text(v_item->'days')),
        p_suggested_time => (v_item->>'time')::time,
        p_goal_id => p_goal
      );
    else
      update public.habits set name = v_item->>'title', description = v_item->>'notes'
      where id = v_id and goal_id = p_goal and user_id = auth.uid() and status = 'active'
        and updated_at = (v_item->>'originalVersion')::timestamptz;
      if not found then raise exception 'Un hábito cambió desde que se preparó la propuesta.'; end if;
    end if;
  end loop;

  update public.goals set ai_plan_summary = p_summary where id = p_goal;
  insert into public.goal_plan_revisions (id, goal_id) values (p_revision, p_goal);
end;
$$;

revoke execute on function public.revise_goal_plan(uuid, uuid, timestamptz, date, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.revise_goal_plan(uuid, uuid, timestamptz, date, text, jsonb, jsonb, jsonb) to authenticated;
