import { queryClient } from '@/data/queryClient';
import { planSchema, type PlanAction, type PlanResource } from '@/domain/capture/actions';
import { addMilestone, createGoal, fetchGoals, linkHabitToGoal, updateGoal } from '@/features/goals/api';
import { createHabit } from '@/features/habits/api';
import { createTask } from '@/features/tasks/api';
import { dayKeyOf, type DayKey } from '@/lib/dates';

/** Qué partes del plan quiere aplicar la persona (índices de tareas y hábitos). */
export interface PlanPick { milestones: boolean; tasks: number[]; habits: number[] }
export const pickAll = (p: PlanAction): PlanPick => ({ milestones: p.milestones.length > 0, tasks: p.tasks.map((_, i) => i), habits: p.habits.map((_, i) => i) });

export function formatResources(list: PlanResource[]): string {
  return list.map((r) => `• ${r.title}${r.note ? ` (${r.note})` : ''}: ${r.url}`).join('\n');
}

/** Texto de notas: qué estudiar + enlaces, recortado al límite de la columna sin partir URLs. */
export function studyNotes(study: string | null, resources: PlanResource[], limit: number): string | null {
  const links = resources.length ? `Recursos:\n${formatResources(resources)}` : '';
  let head = study?.trim() ?? '';
  const sep = head && links ? '\n\n' : '';
  if (head.length + sep.length + links.length > limit) {
    const room = Math.max(0, limit - links.length - sep.length);
    head = room > 1 ? `${head.slice(0, room - 1)}…` : '';
  }
  const text = `${head}${head && links ? '\n\n' : ''}${links}`;
  if (text.length <= limit) return text || null;
  // Sin espacio para todo: conserva los enlaces completos que quepan.
  const lines = links.split('\n');
  let out = lines[0]!;
  for (const l of lines.slice(1)) { if (out.length + 1 + l.length > limit) break; out += `\n${l}`; }
  return out;
}

export interface PlanStep { key: string; label: string; run: (state: { goalId: string | null }) => Promise<void> }

/**
 * Pasos independientes para aplicar el plan. La tarjeta los ejecuta en orden y recuerda
 * los completados, así un reintento tras un fallo de red no duplica lo ya creado.
 */
export function planSteps(proposal: PlanAction, pick: PlanPick, tz: string): PlanStep[] {
  const plan = planSchema.parse(proposal);
  const today = dayKeyOf(new Date(), tz);
  const milestones = pick.milestones ? plan.milestones : [];
  const steps: PlanStep[] = [{
    key: 'goal',
    label: plan.goalId ? `Actualizar la meta «${plan.goal}»` : `Crear la meta «${plan.goal}»`,
    run: async (s) => {
      const extra = plan.resources.length ? `Recursos de estudio:\n${formatResources(plan.resources)}` : '';
      if (!plan.goalId) {
        const description = [plan.why ?? '', extra].filter(Boolean).join('\n\n').slice(0, 2000) || null;
        s.goalId = await createGoal({ title: plan.goal, kind: 'goal', description, metric: milestones.length ? 'milestones' : 'tasks', visibility: 'private', color: 'violet', targetDate: plan.day as DayKey | null, milestones });
        return;
      }
      const goal = (await fetchGoals()).find((g) => g.id === plan.goalId);
      if (!goal) throw new Error('Esa meta ya no existe. Pide un plan nuevo.');
      s.goalId = goal.id;
      if (extra && !(goal.description ?? '').includes(plan.resources[0]!.url)) {
        const description = [goal.description ?? '', extra].filter(Boolean).join('\n\n');
        if (description.length <= 2000) await updateGoal(goal.id, { description });
      }
      const base = goal.milestones.reduce((m, x) => Math.max(m, x.sortOrder), -1) + 1;
      for (const [i, title] of milestones.entries()) await addMilestone(goal.id, title, base + i);
    },
  }];
  for (const i of pick.tasks) {
    const t = plan.tasks[i];
    if (!t) continue;
    steps.push({ key: `task-${i}`, label: `Tarea «${t.title}»`, run: async (s) => {
      await createTask({ title: t.title, priority: t.priority, dueDate: t.day as DayKey | null, estimateMinutes: t.minutes, goalId: s.goalId, notes: studyNotes(t.study, t.resources, 5000) });
    } });
  }
  for (const i of pick.habits) {
    const h = plan.habits[i];
    if (!h) continue;
    steps.push({ key: `habit-${i}`, label: `Hábito «${h.title}»`, run: async (s) => {
      const id = await createHabit({ name: h.title, description: studyNotes(h.study, h.resources, 500) ?? undefined, kind: h.minutes ? 'duration' : 'binary', unit: h.minutes ? 'min' : null, icon: 'book-open', color: 'violet', scheduleDays: h.days.length === 7 ? [] : h.days, startDay: today, priority: 1, period: 'day', target: h.minutes ?? 1, reminderTime: h.time });
      if (s.goalId) await linkHabitToGoal(id, s.goalId);
    } });
  }
  return steps;
}

export const refreshAfterPlan = () => queryClient.invalidateQueries();
