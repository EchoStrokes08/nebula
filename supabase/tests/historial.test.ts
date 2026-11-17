import type { PGlite } from '@electric-sql/pglite';

import { asUser, createTestDb, createUser, expectFailure } from './harness';

let db: PGlite;
let ana: string;
beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, { handle: 'ana' });
});
afterAll(async () => {
  await db.close();
});

describe('historial de tareas (F07-014)', () => {
  it('registra alta, cambios de fecha y de estado, y no se puede alterar', async () => {
    await asUser(db, ana, async (tx) => {
      const id = (await tx.query<{ id: string }>(`insert into public.tasks (title, due_date) values ('Informe', '2026-11-20') returning id`)).rows[0]!.id;
      await tx.query(`update public.tasks set due_date = '2026-11-22' where id = $1`, [id]);
      await tx.query(`update public.tasks set status = 'done' where id = $1`, [id]);
      await tx.query(`update public.tasks set status = 'todo' where id = $1`, [id]);
      const { rows } = await tx.query<{ event: string; old_due: string | null; new_due: string | null }>(
        'select event, old_due::text, new_due::text from public.task_history where task_id = $1 order by id',
        [id],
      );
      expect(rows).toEqual([
        { event: 'created', old_due: null, new_due: '2026-11-20' },
        { event: 'due_changed', old_due: '2026-11-20', new_due: '2026-11-22' },
        { event: 'completed', old_due: null, new_due: null },
        { event: 'reopened', old_due: null, new_due: null },
      ]);
      await expectFailure(tx, `update public.task_history set event = 'completed' where task_id = $1`, [id], /permission denied/);
      await expectFailure(tx, `insert into public.task_history (task_id, user_id, event) values ($1, $2, 'completed')`, [id, ana], /permission denied/);
    });
  });
});
