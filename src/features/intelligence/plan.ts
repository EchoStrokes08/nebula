import { db, unwrap } from '@/data/db';
import { queryClient } from '@/data/queryClient';
import { supabase } from '@/data/supabase';
import { dbPriority, milestoneOf, planSchema, type PlanAction, type PlanResource } from '@/domain/capture/actions';
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

/** Texto de notas: qué estudiar + criterio de terminado + enlaces, sin partir URLs al recortar. */
export function studyNotes(study: string | null, resources: PlanResource[], limit: number, done: string | null = null): string | null {
  if (done) study = [study?.trim(), `Terminado cuando: ${done.trim()}`].filter(Boolean).join('\n\n');
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

/** Lo creado hasta ahora (se conserva entre reintentos): la meta y el id de cada tarea del plan. */
export interface PlanState { goalId: string | null; taskIds: Record<number, string> }
export const emptyPlanState = (): PlanState => ({ goalId: null, taskIds: {} });
export interface PlanStep { key: string; label: string; run: (state: PlanState) => Promise<void> }

/**
 * Pasos independientes para aplicar el plan. La tarjeta los ejecuta en orden y recuerda
 * los completados, así un reintento tras un fallo de red no duplica lo ya creado.
 */
export function planSteps(proposal: PlanAction, pick: PlanPick, tz: string): PlanStep[] {
  const plan = planSchema.parse(proposal);
  const today = dayKeyOf(new Date(), tz);
  const milestones = pick.milestones ? plan.milestones.map(milestoneOf) : [];
  if (plan.revisionId && plan.revisionVersion && plan.goalId) {
    return [{
      key: 'revision',
      label: 'Guardar el rediseño',
      run: async (state) => {
        unwrap(await db().rpc('revise_goal_plan', {
          p_goal: plan.goalId,
          p_revision: plan.revisionId,
          p_version: plan.revisionVersion,
          p_today: today,
          p_summary: studyNotes(plan.why, plan.resources, 5000),
          p_milestones: milestones,
          p_tasks: plan.tasks.flatMap((task, index) => pick.tasks.includes(index) ? [{
            ...task, index, priority: dbPriority(task.priority), notes: studyNotes(task.study, task.resources, 5000, task.done),
          }] : []),
          p_habits: plan.habits.flatMap((habit, index) => pick.habits.includes(index) ? [{
            ...habit, days: habit.days.length === 7 ? [] : habit.days, notes: studyNotes(habit.study, habit.resources, 500),
          }] : []),
        }));
        state.goalId = plan.goalId;
      },
    }];
  }
  const steps: PlanStep[] = [{
    key: 'goal',
    label: plan.goalId ? `Actualizar la meta «${plan.goal}»` : `Crear la meta «${plan.goal}»`,
    run: async (s) => {
      const extra = plan.resources.length ? `Recursos de estudio:\n${formatResources(plan.resources)}` : '';
      if (!plan.goalId) {
        const description = [plan.why ?? '', extra].filter(Boolean).join('\n\n').slice(0, 2000) || null;
        s.goalId = await createGoal({ title: plan.goal, kind: 'goal', description, metric: milestones.length ? 'milestones' : 'tasks', visibility: 'private', color: 'violet', targetDate: plan.day as DayKey | null, milestones: milestones.map((m) => ({ title: m.title, dueDate: m.day as DayKey | null })) });
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
      // Un reintento no repite los hitos que ya se añadieron.
      const existing = new Set(goal.milestones.map((x) => x.title.trim().toLowerCase()));
      for (const [i, m] of milestones.entries()) if (!existing.has(m.title.trim().toLowerCase())) await addMilestone(goal.id, m.title, base + i, m.day as DayKey | null);
    },
  }];
  for (const i of pick.tasks) {
    const t = plan.tasks[i];
    if (!t) continue;
    steps.push({ key: `task-${i}`, label: `Tarea «${t.title}»`, run: async (s) => {
      // Solo dependencias hacia tareas ya creadas de este plan (las no elegidas se ignoran).
      const dependsOn = [...new Set(t.after.filter((j) => j < i).map((j) => s.taskIds[j]).filter((id): id is string => Boolean(id)))];
      s.taskIds[i] = await createTask({ title: t.title, priority: dbPriority(t.priority), dueDate: t.day as DayKey | null, estimateMinutes: t.minutes, goalId: s.goalId, notes: studyNotes(t.study, t.resources, 5000, t.done), subtasks: t.steps, dependsOn });
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

const messageOf = (e: unknown) => (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string' ? e.message : String(e ?? ''));
/** Corte de red, servidor caído un momento o sesión caducada: merece reintentarse solo. */
export function isTransient(e: unknown): boolean {
  const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : '';
  // Errores de datos de Postgres (22xxx, 23xxx, P0001…) no se arreglan reintentando.
  if (/^(22|23|42|P0)/.test(code)) return false;
  return /fetch|network|timeout|timed out|abort|jwt|token|5\d\d|gateway|unavailable|conex/i.test(`${code} ${messageOf(e)}`);
}

/** Ejecuta un paso reintentando hasta 3 veces los fallos pasajeros (renovando la sesión si hace falta). */
export async function runStep(step: PlanStep, state: PlanState, wait = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try { return await step.run(state); } catch (e) {
      if (attempt >= 2 || !isTransient(e)) throw e;
      if (/jwt|token/i.test(messageOf(e))) await supabase?.auth.refreshSession().catch(() => undefined);
      await wait(800 * (attempt + 1));
    }
  }
}

/** Texto para la persona: el motivo real, en palabras comprensibles cuando se conoce. */
export function applyErrorText(e: unknown): string {
  const m = messageOf(e);
  if (/network|fetch|timeout|timed out|abort/i.test(m)) return 'no hay conexión con el servidor';
  if (/jwt|token/i.test(m)) return 'la sesión caducó; vuelve a iniciar sesión';
  return m;
}
