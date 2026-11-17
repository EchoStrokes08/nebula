import type { PGlite } from '@electric-sql/pglite';

import { asUser, createTestDb, createUser, expectFailure } from './harness';

let db: PGlite;
let ana: string;
let ben: string;

/** Crea una tarea como superusuario (datos de partida) con fecha límite opcional. */
const task = async (user: string, title: string, dueDate: string | null = null) => {
  const { rows } = await db.query<{ id: string }>('insert into public.tasks (user_id, title, due_date) values ($1, $2, $3) returning id', [user, title, dueDate]);
  return rows[0]!.id;
};

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, { handle: 'ana' });
  ben = await createUser(db, { handle: 'ben' });
});
afterAll(async () => {
  await db.close();
});

describe('tareas y dependencias (F05)', () => {
  it('rechaza ciclos directos e indirectos', async () => {
    const a = await task(ana, 'HTML');
    const b = await task(ana, 'CSS');
    const c = await task(ana, 'JavaScript');
    await asUser(db, ana, async (tx) => {
      await tx.query('insert into public.task_dependencies (task_id, depends_on) values ($1, $2), ($3, $1)', [b, a, c]);
      await expectFailure(tx, 'insert into public.task_dependencies (task_id, depends_on) values ($1, $2)', [a, c], /ciclo/);
      await expectFailure(tx, 'insert into public.task_dependencies (task_id, depends_on) values ($1, $1)', [a], /check/);
    });
  });

  it('no permite depender de tareas ajenas ni verlas', async () => {
    const mine = await task(ana, 'Mía');
    const theirs = await task(ben, 'Ajena');
    await asUser(db, ana, async (tx) => {
      await expectFailure(tx, 'insert into public.task_dependencies (task_id, depends_on) values ($1, $2)', [mine, theirs], /row-level security|usuarios distintos/);
      expect((await tx.query('select * from public.tasks where id = $1', [theirs])).rows).toHaveLength(0);
      const upd = await tx.query(`update public.tasks set title = 'x' where id = $1`, [theirs]);
      expect(upd.affectedRows).toBe(0);
    });
  });

  it('cuenta aplazamientos y marca la fecha de completado', async () => {
    const t = await task(ana, 'Informe', '2026-11-20');
    await asUser(db, ana, async (tx) => {
      await tx.query(`update public.tasks set due_date = '2026-11-22' where id = $1`, [t]);
      await tx.query(`update public.tasks set due_date = '2026-11-21' where id = $1`, [t]); // adelantar no cuenta
      await tx.query(`update public.tasks set due_date = '2026-11-25' where id = $1`, [t]);
      await tx.query(`update public.tasks set status = 'done' where id = $1`, [t]);
      const { rows } = await tx.query<{ postponed_count: number; completed_at: string | null }>('select postponed_count, completed_at from public.tasks where id = $1', [t]);
      expect(rows[0]!.postponed_count).toBe(2);
      expect(rows[0]!.completed_at).not.toBeNull();
    });
  });

  it('completar una tarea recurrente crea la siguiente con subtareas y etiquetas', async () => {
    const t = await task(ana, 'Revisión semanal', '2026-11-16');
    await db.query(`update public.tasks set recurrence = 'FREQ=WEEKLY;BYDAY=MO' where id = $1`, [t]);
    await db.query(`insert into public.subtasks (task_id, title) values ($1, 'Revisar metas')`, [t]);
    await asUser(db, ana, async (tx) => {
      const tag = (await tx.query<{ id: string }>(`insert into public.tags (name) values ('rutina') returning id`)).rows[0]!.id;
      await tx.query('insert into public.task_tags (task_id, tag_id) values ($1, $2)', [t, tag]);
      const next = (await tx.query<{ id: string }>(`select public.complete_task($1, '2026-11-23') as id`, [t])).rows[0]!.id;
      const { rows } = await tx.query<{ due_date: string; status: string }>('select due_date::text, status from public.tasks where id = $1', [next]);
      expect(rows[0]).toEqual({ due_date: '2026-11-23', status: 'todo' });
      expect((await tx.query('select 1 from public.subtasks where task_id = $1', [next])).rows).toHaveLength(1);
      expect((await tx.query('select 1 from public.task_tags where task_id = $1', [next])).rows).toHaveLength(1);
      await expectFailure(tx, `select public.complete_task($1, '2026-11-01')`, [next], /posterior/);
    });
  });

  it('las metas: vínculos solo propios e historial de avance inmutable', async () => {
    const goalB = (await db.query<{ id: string }>(`insert into public.goals (user_id, title) values ($1, 'Meta de Ben') returning id`, [ben])).rows[0]!.id;
    await asUser(db, ana, async (tx) => {
      await expectFailure(tx, `insert into public.tasks (title, goal_id) values ('x', $1)`, [goalB], /meta no válida/);
      const g = (await tx.query<{ id: string }>(`insert into public.goals (title, metric, metric_target, metric_unit) values ('Leer', 'quantity', 12, 'libros') returning id`)).rows[0]!.id;
      await tx.query(`insert into public.goal_progress_events (goal_id, delta) values ($1, 2)`, [g]);
      await expectFailure(tx, `update public.goal_progress_events set delta = 50 where goal_id = $1`, [g], /permission denied/);
      await expectFailure(tx, `insert into public.goal_progress_events (goal_id, delta) values ($1, 1)`, [goalB], /row-level security/);
      await expectFailure(tx, `insert into public.goals (title, metric) values ('Sin unidad', 'quantity')`, [], /goals_quantity_target/);
    });
  });

  it('valida el formato de recurrencia', async () => {
    await asUser(db, ana, async (tx) => {
      await expectFailure(tx, `insert into public.tasks (title, due_date, recurrence) values ('x', '2026-11-16', 'cada lunes')`, [], /recurrence/);
      await expectFailure(tx, `insert into public.tasks (title, recurrence) values ('x', 'FREQ=DAILY')`, [], /tasks_recurrence_needs_due/);
    });
  });
});
