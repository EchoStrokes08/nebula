import type { PGlite } from '@electric-sql/pglite';

import { asUser, createTestDb, createUser, expectFailure } from './harness';

let db: PGlite;
let ana: string;
let ben: string;

const triage = (user: string, id: string, kind = 'todo') =>
  db.query(`insert into public.mail_triage (user_id, message_id, thread_id, sender, subject, received_at, kind, title)
            values ($1, $2, $2, 'Banco', 'Recibo', now(), $3, 'Pagar el recibo')`, [user, id, kind]);
const task = async (user: string) =>
  (await db.query<{ id: string }>(`insert into public.tasks (user_id, title) values ($1, 'Pagar') returning id`, [user])).rows[0]!.id;

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, { handle: 'ana' });
  ben = await createUser(db, { handle: 'ben' });
});
afterAll(async () => {
  await db.close();
});

it('el permiso renovable de Gmail solo lo toca el servidor', async () => {
  await db.query(`insert into public.gmail_tokens (user_id, refresh_token) values ($1, '1//refresh-token-de-prueba')`, [ana]);
  await asUser(db, ana, async (tx) => {
    await expectFailure(tx, 'select refresh_token from public.gmail_tokens', [], /permission denied/);
  });
});

it('cada persona ve y decide solo sobre sus correos', async () => {
  await triage(ana, 'a1');
  await triage(ben, 'b1');
  const mine = await task(ana);
  await asUser(db, ana, async (tx) => {
    const { rows } = await tx.query<{ message_id: string }>('select message_id from public.mail_triage');
    expect(rows.map((r) => r.message_id)).toEqual(['a1']);
    await tx.query(`update public.mail_triage set status = 'task', task_id = $1 where message_id = 'a1'`, [mine]);
    const other = await tx.query(`update public.mail_triage set status = 'dismissed' where message_id = 'b1'`);
    expect(other.affectedRows).toBe(0);
  });
  const { rows } = await db.query<{ status: string }>(`select status from public.mail_triage where message_id = 'b1'`);
  expect(rows[0]!.status).toBe('new');
});

it('no se puede enlazar una tarea ajena ni reescribir la clasificación', async () => {
  await triage(ana, 'a2');
  const theirs = await task(ben);
  await asUser(db, ana, async (tx) => {
    await expectFailure(tx, `update public.mail_triage set task_id = $1 where message_id = 'a2'`, [theirs], /row-level security/);
  });
  await asUser(db, ana, async (tx) => {
    await expectFailure(tx, `update public.mail_triage set kind = 'ignore' where message_id = 'a2'`, [], /permission denied/);
  });
  await asUser(db, ana, async (tx) => {
    await expectFailure(tx, `insert into public.mail_triage (user_id, message_id, thread_id, sender, subject, received_at, kind) values ($1, 'x', 'x', 'a', 'b', now(), 'todo')`, [ana], /permission denied/);
  });
});

it('borrar la tarea deja la sugerencia sin enlace', async () => {
  await triage(ana, 'a3');
  const t = await task(ana);
  await db.query(`update public.mail_triage set status = 'task', task_id = $1 where message_id = 'a3'`, [t]);
  await db.query('delete from public.tasks where id = $1', [t]);
  const { rows } = await db.query<{ task_id: string | null }>(`select task_id from public.mail_triage where message_id = 'a3'`);
  expect(rows[0]!.task_id).toBeNull();
});
