import { assistantContextSchema } from '@/domain/assistant/context';
import type { Task } from '@/features/tasks/api';
import type { DayKey } from '@/lib/dates';

import { buildAssistantContext, partOfDay } from './buildContext';

const today = '2026-11-17' as DayKey;
const task = (over: Partial<Task>): Task => ({
  id: '11111111-1111-4111-8111-111111111111', goalId: null, title: 'Preparar examen', notes: 'secreto', status: 'todo', priority: 2,
  dueDate: today, dueTime: null, estimateMinutes: 60, scheduledStart: null, scheduledEnd: null, recurrence: null, reminderAt: null,
  postponedCount: 3, sortOrder: 1, completedAt: null, createdAt: '2026-11-01T00:00:00Z', subtasks: [], tags: [], dependsOn: [], ...over,
});
const base = {
  now: new Date('2026-11-17T09:30:00Z'), today, tz: 'Europe/Madrid', name: 'Oscar', prefs: null, about: 'Estudio por las mañanas', tone: 'directo' as const,
  habits: [], logs: [], goals: [], events: [], focus: [], challenges: [], journal: [], insights: [], shareJournal: false,
};

describe('buildAssistantContext', () => {
  it('incluye tareas con id real, contexto personal y hora local sin notas privadas', () => {
    const c = buildAssistantContext({ ...base, tasks: [task({}), task({ id: '22222222-2222-4222-8222-222222222222', title: 'Hecha', status: 'done', completedAt: '2026-11-16T10:00:00Z' })] });
    expect(assistantContextSchema.safeParse(c).success).toBe(true);
    expect(c.now.time).toBe('10:30');
    expect(c.person).toMatchObject({ name: 'Oscar', about: 'Estudio por las mañanas', tone: 'directo' });
    expect(c.tasks).toHaveLength(1);
    expect(c.tasks[0]).toMatchObject({ id: '11111111-1111-4111-8111-111111111111', postponed: 3 });
    expect(c.recentlyDone).toEqual(['Hecha']);
    expect(c.week.tasksCompleted).toBe(1);
    expect(JSON.stringify(c)).not.toContain('secreto');
  });
  it('solo comparte el diario si se activa', () => {
    const journal = [{ id: 'j', day_key: today, kind: 'daily' as const, achievements: 'Terminé', difficulties: '', learnings: '', next_step: '', goal_id: null }];
    expect(buildAssistantContext({ ...base, tasks: [], journal }).journal).toHaveLength(0);
    expect(buildAssistantContext({ ...base, tasks: [], journal, shareJournal: true }).journal).toHaveLength(1);
  });
  it('acota listas largas', () => {
    const many = Array.from({ length: 60 }, (_, i) => task({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` }));
    expect(buildAssistantContext({ ...base, tasks: many }).tasks).toHaveLength(30);
  });
  it('clasifica la parte del día', () => {
    expect([partOfDay(3), partOfDay(9), partOfDay(16), partOfDay(22)]).toEqual(['madrugada', 'mañana', 'tarde', 'noche']);
  });
});
