/** Pantalla que abre una notificación al tocarla, según su id (formato propio y estable). */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export function routeForNotification(id: string | null | undefined): string {
  if (!id) return '/hoy';
  if (id.startsWith('nebula-weekly-')) return '/revision';
  if (id === 'focus-end') return '/enfoque';
  if (id.startsWith('nebula-event-')) return '/agenda';
  const habit = new RegExp(`^nebula-habit-(${UUID})-`).exec(id);
  if (habit) return `/habito/${habit[1]}`;
  const task = new RegExp(`^nebula-task-(${UUID})$`).exec(id);
  if (task) return `/tarea/${task[1]}`;
  if (id.startsWith('social-')) return '/notificaciones';
  return '/hoy';
}
