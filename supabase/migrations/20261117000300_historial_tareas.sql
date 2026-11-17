-- Nebula · F07-014 / F10-011 — Historial de tareas (auditoría) para la revisión de compromisos
-- y la detección de fricción. Lo escribe solo la base de datos; el usuario puede leerlo pero no
-- modificarlo, así las estadísticas reflejan lo que de verdad ocurrió.
create type public.task_event as enum ('created', 'due_changed', 'completed', 'reopened', 'cancelled');

create table public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event public.task_event not null,
  old_due date,
  new_due date,
  at timestamptz not null default now()
);
create index task_history_user_at_idx on public.task_history (user_id, at);

create function public.tasks_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_history (task_id, user_id, event, new_due) values (new.id, new.user_id, 'created', new.due_date);
    return new;
  end if;
  if new.due_date is distinct from old.due_date then
    insert into public.task_history (task_id, user_id, event, old_due, new_due) values (new.id, new.user_id, 'due_changed', old.due_date, new.due_date);
  end if;
  if new.status is distinct from old.status then
    insert into public.task_history (task_id, user_id, event)
    values (new.id, new.user_id, case new.status when 'done' then 'completed'::public.task_event when 'cancelled' then 'cancelled'::public.task_event else 'reopened'::public.task_event end);
  end if;
  return new;
end;
$$;
create trigger tasks_audit after insert or update on public.tasks for each row execute function public.tasks_audit();

alter table public.task_history enable row level security;
create policy task_history_read_own on public.task_history for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.task_history from authenticated;
revoke all on public.task_history from anon;
