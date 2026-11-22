import { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb, createUser, expectFailure } from './harness';

let db: PGlite;
let user: string;
let other: string;
beforeAll(async () => {
  db = await createTestDb();
  user = await createUser(db);
  other = await createUser(db);
});
afterAll(async () => { await db?.close(); });

const revise = "select revise_goal_plan($1, $2, $3, '2026-11-22', $4, $5::jsonb, $6::jsonb, $7::jsonb)";
const revision = '42d37a73-2080-4ea5-883a-af449498b244';

it('rediseña sobre las mismas filas y conserva hitos, tareas e historial ya realizados', async () => {
  await asUser(db, user, async (tx) => {
    const goal = (await tx.query<{ id: string; updated_at: Date }>("insert into goals (title) values ('Aprender Python') returning id, updated_at")).rows[0]!;
    const milestone = (await tx.query<{ id: string }>("insert into milestones (goal_id, title) values ($1, 'Entender Python') returning id", [goal.id])).rows[0]!;
    await tx.query("insert into milestones (goal_id, title, done_at) values ($1, 'Completar diagnóstico', now())", [goal.id]);
    const task = (await tx.query<{ id: string; updated_at: Date }>("insert into tasks (goal_id, title) values ($1, 'Revisar bucles') returning id, updated_at", [goal.id])).rows[0]!;
    await tx.query("insert into tasks (goal_id, title, status) values ($1, 'Leer la introducción', 'done')", [goal.id]);
    await tx.query("insert into subtasks (task_id, title) values ($1, 'Leer')", [task.id]);
    const args = [
      goal.id, revision, goal.updated_at, 'Crea un script y verifica su salida.',
      JSON.stringify([{ replaceId: milestone.id, originalTitle: 'Entender Python', title: 'Procesar un CSV' }]),
      JSON.stringify([
        { replaceId: task.id, originalVersion: task.updated_at, index: 0, title: 'Leer las filas del CSV', minutes: 30, priority: 2, notes: 'Procesa tres filas.', steps: ['Lee el encabezado', 'Comprueba los campos'], after: [] },
        { index: 1, title: 'Validar el CSV de salida', minutes: 30, priority: 2, steps: ['Compara la salida'], after: [0] },
      ]),
      JSON.stringify([{ title: 'Practicar ejercicios', minutes: 15, days: [1, 3], notes: 'Resuelve un ejercicio.' }]),
    ];
    await tx.query(revise, args);
    await tx.query(revise, args); // la respuesta HTTP se pudo perder después de guardar
    expect((await tx.query('select title from tasks where goal_id = $1 order by title', [goal.id])).rows).toEqual([
      { title: 'Leer la introducción' }, { title: 'Leer las filas del CSV' }, { title: 'Validar el CSV de salida' },
    ]);
    expect((await tx.query('select title from tasks where id = $1', [task.id])).rows).toEqual([{ title: 'Leer las filas del CSV' }]);
    expect((await tx.query('select title from subtasks where task_id = $1 order by sort_order', [task.id])).rows).toEqual([
      { title: 'Lee el encabezado' }, { title: 'Comprueba los campos' },
    ]);
    expect((await tx.query('select depends_on from task_dependencies where depends_on = $1', [task.id])).rows).toEqual([{ depends_on: task.id }]);
    expect((await tx.query('select title from milestones where goal_id = $1 order by title', [goal.id])).rows).toEqual([
      { title: 'Completar diagnóstico' }, { title: 'Procesar un CSV' },
    ]);
    expect((await tx.query('select name from habits where goal_id = $1', [goal.id])).rows).toEqual([{ name: 'Practicar ejercicios' }]);
    expect((await tx.query('select ai_plan_summary from goals where id = $1', [goal.id])).rows).toEqual([{ ai_plan_summary: args[3] }]);
  });
});

it('revierte las altas de la propuesta si una tarea ya empezó y exige que la meta sea propia', async () => {
  const goal = (await db.query<{ id: string; updated_at: Date }>("insert into goals (user_id, title) values ($1, 'Aprender inglés') returning id, updated_at", [user])).rows[0]!;
  await asUser(db, other, (tx) => expectFailure(tx, revise, [goal.id, revision, goal.updated_at, null, '[]', '[]', '[]'], /meta ya no está disponible/));
  await asUser(db, user, async (tx) => {
    const task = (await tx.query<{ id: string; updated_at: Date }>("insert into tasks (goal_id, title, status) values ($1, 'Preparar entrevista', 'in_progress') returning id, updated_at", [goal.id])).rows[0]!;
    await expectFailure(tx, revise, [
      goal.id, revision, goal.updated_at, 'Estrategia', '[{"title":"Hito nuevo"}]',
      JSON.stringify([{ replaceId: task.id, originalVersion: task.updated_at, title: 'Otro título' }]), '[]',
    ], /Una tarea cambió/);
    expect((await tx.query('select title from milestones where goal_id = $1', [goal.id])).rows).toEqual([]);
    expect((await tx.query('select title from tasks where id = $1', [task.id])).rows).toEqual([{ title: 'Preparar entrevista' }]);
  });
});
