import { validate } from '@/features/auth/validation';

import { taskFormSchema } from './validation';

const base = { title: 'Informe', priority: 2, dueDate: null, dueTime: null, estimateMinutes: null, recurrence: null, reminderMinutesBefore: null, goalId: null };

describe('formulario de tarea', () => {
  it('acepta lo mínimo', () => expect(validate(taskFormSchema, base).ok).toBe(true));
  it('recurrencia, hora y recordatorio exigen fecha', () => {
    const r = validate(taskFormSchema, { ...base, recurrence: 'FREQ=DAILY', dueTime: '09:00', reminderMinutesBefore: 10 });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['dueTime', 'recurrence', 'reminderMinutesBefore']);
  });
  it('valida duración y hora', () => {
    const r = validate(taskFormSchema, { ...base, dueDate: '2026-11-20', dueTime: '25:00', estimateMinutes: 0 });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['dueTime', 'estimateMinutes']);
  });
});
