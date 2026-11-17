import { TZDate } from '@date-fns/tz';
import { queryClient } from '@/data/queryClient';
import { actionSchema, type ProposedAction } from '@/domain/capture/actions';
import { createHabit } from '@/features/habits/api';
import { createTask, fetchTasks, updateTask } from '@/features/tasks/api';
import { createGoal } from '@/features/goals/api';
import { createEvent, fetchEvents } from '@/features/agenda/api';
import { expandEvents } from '@/domain/calendar/expand';
import { dayKeyOf, type DayKey } from '@/lib/dates';

export function actionStart(day: string, time: string, tz: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const [h, min] = time.split(':').map(Number) as [number, number];
  const start = new Date(new TZDate(y, m - 1, d, h, min, 0, tz).getTime());
  // Rechaza horas inexistentes durante un cambio DST.
  const local = new TZDate(start.getTime(), tz);
  if (local.getHours() !== h || local.getMinutes() !== min) throw new Error('Esa hora no existe en tu zona horaria. Elige otra.');
  return start;
}
export function describeAction(a: ProposedAction): string {
  switch (a.type) {
    case 'create_task': return `Tarea: ${a.title}${a.day ? ` · ${a.day}` : ''}${a.time ? ` ${a.time}` : ''}${a.minutes ? ` · ${a.minutes} min` : ''}`;
    case 'create_habit': return `Hábito: ${a.title} · ${a.minutes ? `${a.minutes} min diarios` : 'una vez al día'}${a.time ? ` · ${a.time}` : ''}`;
    case 'create_goal': return `Meta: ${a.title}${a.day ? ` · ${a.day}` : ''} · ${a.milestones.length} hitos`;
    case 'create_event': return `Evento: ${a.title} · ${a.day} ${a.time} · ${a.minutes} min`;
    case 'move_task': return `Mover tarea al ${a.day} a las ${a.time} (${a.minutes} min)`;
    case 'estimate_task': return `Estimar tarea en ${a.minutes} min`;
    case 'prioritize_task': return `Prioridad de tarea: ${a.priority}`;
  }
}
/** Ejecutar solo desde un botón de confirmación explícita. Nunca desde una respuesta del modelo. */
export async function applyAction(proposal: ProposedAction, tz: string): Promise<void> {
  const a = actionSchema.parse(proposal);
  const today = dayKeyOf(new Date(), tz);
  if (a.type === 'create_task') await createTask({ title: a.title, priority: a.priority, dueDate: a.day as DayKey | null, dueTime: a.time, estimateMinutes: a.minutes, recurrence: a.recurrence ? `FREQ=${a.recurrence.toUpperCase()}` : null });
  else if (a.type === 'create_habit') await createHabit({ name: a.title, kind: a.minutes ? 'duration' : 'binary', unit: a.minutes ? 'min' : null, icon: 'circle', color: 'violet', scheduleDays: a.days, startDay: today, priority: 1, period: 'day', target: a.minutes ?? 1, reminderTime: a.time });
  else if (a.type === 'create_goal') await createGoal({ title: a.title, kind: 'goal', metric: a.milestones.length ? 'milestones' : 'tasks', visibility: 'private', color: 'violet', targetDate: a.day as DayKey | null, milestones: a.milestones });
  else if (a.type === 'estimate_task') await updateTask(a.id, { estimateMinutes: a.minutes });
  else if (a.type === 'prioritize_task') await updateTask(a.id, { priority: a.priority });
  else {
    const start = actionStart(a.day, a.time, tz); const end = new Date(start.getTime() + a.minutes * 60000);
    const [events, tasks] = await Promise.all([fetchEvents(), fetchTasks()]);
    const overlaps = (s: string | Date, e: string | Date) => new Date(s).getTime() < end.getTime() && new Date(e).getTime() > start.getTime();
    const occurrences = expandEvents(events, a.day as DayKey, dayKeyOf(end, tz), tz);
    if (occurrences.some((e) => overlaps(e.start, e.end)) || tasks.some((t) => t.id !== (a.type === 'move_task' ? a.id : null) && t.status !== 'done' && t.status !== 'cancelled' && t.scheduledStart && t.scheduledEnd && overlaps(t.scheduledStart, t.scheduledEnd))) throw new Error('Este bloque se solapa con un compromiso. Elige otro horario.');
    if (a.type === 'move_task') await updateTask(a.id, { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString(), dueDate: a.day as DayKey });
    else await createEvent({ title: a.title, startsAt: start.toISOString(), endsAt: end.toISOString(), allDay: false, tz, category: 'personal', recurrence: null, recurrenceUntil: null, reminderMinutes: null });
  }
  await queryClient.invalidateQueries();
}
