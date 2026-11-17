-- Nebula · F05 — Tareas, subtareas, etiquetas, metas/proyectos, hitos, progreso y dependencias.
-- Reglas: docs/REGLAS_NEGOCIO.md §6–7.

create type public.task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type public.goal_kind as enum ('goal', 'project');
create type public.goal_status as enum ('active', 'paused', 'completed', 'abandoned');
create type public.goal_metric as enum ('quantity', 'milestones', 'tasks');

-- Metas y proyectos ------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.goal_kind not null default 'goal',
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (char_length(description) <= 2000),
  expected_outcome text check (char_length(expected_outcome) <= 500),
  target_date date,
  metric public.goal_metric not null default 'milestones',
  metric_target numeric(12, 2) check (metric_target > 0),
  metric_unit text check (char_length(metric_unit) <= 20),
  status public.goal_status not null default 'active',
  visibility public.profile_visibility not null default 'private',
  color text not null default 'violet' check (color in ('violet', 'lavender', 'cyan', 'green', 'amber', 'rose', 'coral', 'sky')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_quantity_target check (metric <> 'quantity' or (metric_target is not null and metric_unit is not null))
);
create index goals_user_idx on public.goals (user_id, status);
create trigger goals_touch before update on public.goals for each row execute function public.touch_updated_at();

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  due_date date,
  done_at timestamptz,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now()
);
create index milestones_goal_idx on public.milestones (goal_id, sort_order);

-- Avance medible manual (metas de tipo cantidad). Historial inmutable: se corrige con otro evento.
create table public.goal_progress_events (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  delta numeric(12, 2) not null check (delta <> 0 and abs(delta) <= 1000000),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index goal_progress_goal_idx on public.goal_progress_events (goal_id, created_at);

alter table public.habits add column goal_id uuid references public.goals (id) on delete set null;

-- Tareas -----------------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text check (char_length(notes) <= 5000),
  status public.task_status not null default 'todo',
  priority smallint not null default 2 check (priority between 1 and 3),
  due_date date,
  due_time time,
  estimate_minutes integer check (estimate_minutes between 1 and 1440),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  recurrence text check (recurrence ~ '^FREQ=(DAILY|WEEKLY|MONTHLY)(;INTERVAL=[1-9][0-9]?)?(;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*)?$'),
  recurrence_parent_id uuid references public.tasks (id) on delete set null,
  reminder_at timestamptz,
  postponed_count integer not null default 0 check (postponed_count >= 0),
  sort_order double precision not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_schedule_order check (scheduled_end is null or scheduled_start is null or scheduled_end > scheduled_start),
  constraint tasks_recurrence_needs_due check (recurrence is null or due_date is not null)
);
create index tasks_user_status_idx on public.tasks (user_id, status, due_date);
create index tasks_goal_idx on public.tasks (goal_id);

-- Aplazar = mover la fecha límite hacia delante: se cuenta para detectar fricción (F10-011).
create function public.tasks_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if old.due_date is not null and new.due_date is not null and new.due_date > old.due_date then
    new.postponed_count := old.postponed_count + 1;
  end if;
  if new.status = 'done' and old.status <> 'done' then new.completed_at := now(); end if;
  if new.status <> 'done' then new.completed_at := null; end if;
  return new;
end;
$$;
create trigger tasks_before_update before update on public.tasks for each row execute function public.tasks_before_update();

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  done boolean not null default false,
  sort_order double precision not null default 0
);
create index subtasks_task_idx on public.subtasks (task_id, sort_order);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  unique (user_id, name)
);

create table public.task_tags (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

-- Dependencias (grafo acíclico) ------------------------------------------------------------
create table public.task_dependencies (
  task_id uuid not null references public.tasks (id) on delete cascade,
  depends_on uuid not null references public.tasks (id) on delete cascade,
  primary key (task_id, depends_on),
  check (task_id <> depends_on)
);
create index task_dependencies_dep_idx on public.task_dependencies (depends_on);

create function public.task_dependencies_no_cycle() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Hay ciclo si `depends_on` ya depende (directa o indirectamente) de `task_id`.
  if exists (
    with recursive chain(id) as (
      select d.depends_on from public.task_dependencies d where d.task_id = new.depends_on
      union
      select d.depends_on from public.task_dependencies d join chain c on d.task_id = c.id
    )
    select 1 from chain where id = new.task_id
  ) then
    raise exception 'task_dependencies: la dependencia crearía un ciclo' using errcode = 'check_violation';
  end if;
  -- Ambas tareas deben ser del mismo usuario.
  if (select user_id from public.tasks where id = new.task_id) is distinct from (select user_id from public.tasks where id = new.depends_on) then
    raise exception 'task_dependencies: tareas de usuarios distintos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger task_dependencies_no_cycle before insert or update on public.task_dependencies
  for each row execute function public.task_dependencies_no_cycle();

-- Propiedad ---------------------------------------------------------------------------------
create function public.owns_goal(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.goals where id = g and user_id = (select auth.uid()));
$$;
create function public.owns_task(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tasks where id = t and user_id = (select auth.uid()));
$$;
create function public.owns_tag(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tags where id = t and user_id = (select auth.uid()));
$$;
revoke all on function public.owns_goal(uuid), public.owns_task(uuid), public.owns_tag(uuid) from public;
grant execute on function public.owns_goal(uuid), public.owns_task(uuid), public.owns_tag(uuid) to authenticated;

-- Una tarea o un hábito solo pueden vincularse a metas propias.
create function public.check_goal_link() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.goal_id is not null and not exists (select 1 from public.goals g where g.id = new.goal_id and g.user_id = new.user_id) then
    raise exception 'meta no válida' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger tasks_goal_link before insert or update of goal_id on public.tasks for each row execute function public.check_goal_link();
create trigger habits_goal_link before insert or update of goal_id on public.habits for each row execute function public.check_goal_link();

alter table public.goals enable row level security;
alter table public.milestones enable row level security;
alter table public.goal_progress_events enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.tags enable row level security;
alter table public.task_tags enable row level security;
alter table public.task_dependencies enable row level security;

create policy goals_own on public.goals for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy milestones_own on public.milestones for all to authenticated using (public.owns_goal(goal_id)) with check (public.owns_goal(goal_id));
create policy goal_progress_select on public.goal_progress_events for select to authenticated using (user_id = (select auth.uid()));
create policy goal_progress_insert on public.goal_progress_events for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_goal(goal_id));
create policy tasks_own on public.tasks for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy subtasks_own on public.subtasks for all to authenticated using (public.owns_task(task_id)) with check (public.owns_task(task_id));
create policy tags_own on public.tags for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy task_tags_own on public.task_tags for all to authenticated
  using (public.owns_task(task_id)) with check (public.owns_task(task_id) and public.owns_tag(tag_id));
create policy task_dependencies_own on public.task_dependencies for all to authenticated
  using (public.owns_task(task_id)) with check (public.owns_task(task_id) and public.owns_task(depends_on));

revoke all on public.goals, public.milestones, public.goal_progress_events, public.tasks, public.subtasks, public.tags, public.task_tags, public.task_dependencies from anon;
revoke update, delete on public.goal_progress_events from authenticated;

-- Completar una tarea; si es recurrente, crea la siguiente en la misma transacción.
-- La siguiente fecha la calcula el cliente con src/domain/tasks/recurrence.ts y se valida aquí.
create function public.complete_task(p_task uuid, p_next_due date default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  t public.tasks;
  next_id uuid;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found then raise exception 'tarea no encontrada'; end if;
  update public.tasks set status = 'done' where id = p_task;
  if t.recurrence is not null and p_next_due is not null then
    if p_next_due <= t.due_date then raise exception 'la siguiente fecha debe ser posterior' using errcode = 'check_violation'; end if;
    insert into public.tasks (user_id, goal_id, title, notes, priority, due_date, due_time, estimate_minutes, recurrence, recurrence_parent_id, sort_order)
    values (t.user_id, t.goal_id, t.title, t.notes, t.priority, p_next_due, t.due_time, t.estimate_minutes, t.recurrence, coalesce(t.recurrence_parent_id, t.id), t.sort_order)
    returning id into next_id;
    insert into public.subtasks (task_id, title, sort_order) select next_id, s.title, s.sort_order from public.subtasks s where s.task_id = p_task;
    insert into public.task_tags (task_id, tag_id) select next_id, tt.tag_id from public.task_tags tt where tt.task_id = p_task;
  end if;
  return next_id;
end;
$$;
revoke all on function public.complete_task(uuid, date) from public;
grant execute on function public.complete_task(uuid, date) to authenticated;
