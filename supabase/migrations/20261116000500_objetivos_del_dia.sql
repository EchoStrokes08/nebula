-- Nebula · F04 — Una versión de objetivo que empieza hoy (o en el futuro) aún no ha evaluado
-- ningún periodo cerrado: se puede corregir. Las que empiezan en días pasados siguen inmutables.
-- Se usa un día de margen (UTC) por diferencias de zona horaria.
grant update on public.habit_targets to authenticated;
create policy habit_targets_update_current on public.habit_targets for update to authenticated
  using (public.owns_habit(habit_id) and valid_from >= (now() at time zone 'UTC')::date - 1)
  with check (public.owns_habit(habit_id) and valid_from >= (now() at time zone 'UTC')::date - 1);
