import type { PGlite } from '@electric-sql/pglite';

import { createTestDb, createUser } from './harness';

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.close();
});

async function as(user: string, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user]);
    return (await tx.query(sql, params)).rows;
  });
}

describe('eliminar cuenta (F03-011)', () => {
  it('borra todos los datos del usuario y conserva anonimizados los resultados compartidos', async () => {
    const ana = await createUser(db, { handle: 'ana' });
    const ben = await createUser(db, { handle: 'ben' });
    const h = (await db.query<{ id: string }>(`insert into public.habits (user_id, name, kind) values ($1, 'Leer', 'binary') returning id`, [ana])).rows[0]!.id;
    await db.query(`insert into public.habit_logs (habit_id, user_id, day_key, value) values ($1, $2, current_date, 1)`, [h, ana]);
    await db.query(`insert into public.tasks (user_id, title) values ($1, 'x')`, [ana]);
    const c = (await db.query<{ id: string }>(`insert into public.challenges (created_by, kind, title, metric, source, unit, starts_on, ends_on, status) values ($1, 'duel', 'r', 'sessions', 'focus', 'min', current_date, current_date, 'finished') returning id`, [ben])).rows[0]!.id;
    await db.query(`insert into public.challenge_results (challenge_id, user_id, rank, value, score, days_active) values ($1, $2, 1, 10, 10, 1), ($1, $3, 2, 5, 5, 1)`, [c, ana, ben]);

    await as(ana, 'select public.delete_my_account()');

    for (const [table, col] of [['profiles', 'id'], ['habits', 'user_id'], ['habit_logs', 'user_id'], ['tasks', 'user_id'], ['user_preferences', 'user_id']]) {
      expect((await db.query(`select 1 from public.${table} where ${col} = $1`, [ana])).rows).toHaveLength(0);
    }
    const results = (await db.query<{ user_id: string | null }>(`select user_id from public.challenge_results where challenge_id = $1 order by rank`, [c])).rows;
    expect(results).toEqual([{ user_id: null }, { user_id: ben }]);
  });

  it('borra una cuenta recién creada y sin datos (como hace account-delete)', async () => {
    const ana = await createUser(db, { handle: 'vacia' });
    await db.query('delete from auth.users where id = $1', [ana]);
    expect((await db.query('select 1 from public.profiles where id = $1', [ana])).rows).toHaveLength(0);
  });

  it('borra una sesión de enfoque enlazada a un hábito y a una tarea propios', async () => {
    const ana = await createUser(db, { handle: 'enfoque' });
    const h = (await db.query<{ id: string }>(`insert into public.habits (user_id, name, kind) values ($1, 'Leer', 'binary') returning id`, [ana])).rows[0]!.id;
    const t = (await db.query<{ id: string }>(`insert into public.tasks (user_id, title) values ($1, 'x') returning id`, [ana])).rows[0]!.id;
    await db.query(`insert into public.focus_sessions (user_id, mode, planned_minutes, started_at, habit_id, task_id) values ($1, 'pomodoro', 25, now(), $2, $3)`, [ana, h, t]);
    await db.query('delete from auth.users where id = $1', [ana]);
    expect((await db.query('select 1 from public.focus_sessions where user_id = $1', [ana])).rows).toHaveLength(0);
  });

  it('un anónimo no puede ejecutarla', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec('set local role anon');
        await tx.query('select public.delete_my_account()');
      }),
    ).rejects.toThrow(/permission denied/);
  });
});
