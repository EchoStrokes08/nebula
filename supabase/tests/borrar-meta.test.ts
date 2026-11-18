import type { PGlite } from '@electric-sql/pglite';

import { asUser, createTestDb, createUser, expectFailure } from './harness';

let db: PGlite;
let ana: string;
let ben: string;

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db);
  ben = await createUser(db);
});
afterAll(async () => {
  await db.close();
});

const one = async <T>(tx: { query: PGlite['query'] }, sql: string, params: unknown[] = []) => (await tx.query<T>(sql, params)).rows[0]!;

it('borrar una meta elimina sus hitos, tareas, hábitos y registros, y conserva lo demás', async () => {
  await asUser(db, ana, async (tx) => {
    const goal = (await one<{ id: string }>(tx, `insert into goals (title) values ('Aprender Python') returning id`)).id;
    await tx.query(`insert into milestones (goal_id, title) values ($1, 'Sintaxis')`, [goal]);
    const task = (await one<{ id: string }>(tx, `insert into tasks (title, goal_id) values ('Instalar Python', $1) returning id`, [goal])).id;
    await tx.query(`insert into subtasks (task_id, title) values ($1, 'Descargar')`, [task]);
    const habit = (await one<{ id: string }>(tx, `select create_habit('Practicar', 'binary', 'day', 1, current_date, p_goal_id => $1) as id`, [goal])).id;
    await tx.query(`insert into habit_logs (habit_id, day_key, value) values ($1, current_date, 1)`, [habit]);
    await tx.query(`insert into focus_sessions (task_id, habit_id, started_at, ended_at, planned_minutes, focused_seconds, mode, status) values ($1, $2, now() - interval '30 minutes', now(), 25, 1500, 'pomodoro', 'completed')`, [task, habit]);
    const other = (await one<{ id: string }>(tx, `insert into tasks (title) values ('Comprar pan') returning id`)).id;

    expect((await one<{ r: unknown }>(tx, 'select delete_goal($1) as r', [goal])).r).toEqual({ tasks: 1, habits: 1 });

    for (const table of ['goals', 'tasks', 'habits']) expect((await tx.query(`select 1 from ${table} where id = $1`, [table === 'goals' ? goal : table === 'tasks' ? task : habit])).rows).toHaveLength(0);
    expect((await tx.query('select 1 from milestones where goal_id = $1', [goal])).rows).toHaveLength(0);
    expect((await tx.query('select 1 from subtasks where task_id = $1', [task])).rows).toHaveLength(0);
    expect((await tx.query('select 1 from habit_logs where habit_id = $1', [habit])).rows).toHaveLength(0);
    expect((await tx.query('select 1 from tasks where id = $1', [other])).rows).toHaveLength(1);
    // El tiempo de enfoque es historia de la persona: se conserva sin vínculo.
    expect((await one<{ n: number }>(tx, 'select count(*)::int as n from focus_sessions where task_id is null and habit_id is null')).n).toBe(1);
  });
});

it('no deja borrar metas ajenas ni a anónimos', async () => {
  const goal = (await one<{ id: string }>(db, `insert into goals (user_id, title) values ($1, 'Meta de Ana') returning id`, [ana])).id;
  await db.query(`insert into tasks (user_id, title, goal_id) values ($1, 'Tarea de Ana', $2)`, [ana, goal]);
  await asUser(db, ben, async (tx) => {
    await expectFailure(tx, 'select delete_goal($1)', [goal], /meta no encontrada/);
  });
  await asUser(db, null, async (tx) => {
    await expectFailure(tx, 'select delete_goal($1)', [goal], /permission denied/);
  });
  expect((await db.query('select 1 from tasks where goal_id = $1', [goal])).rows).toHaveLength(1);
});
