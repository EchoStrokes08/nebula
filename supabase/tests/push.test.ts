import type { PGlite } from '@electric-sql/pglite';

import { asUser, createTestDb, createUser, expectFailure } from './harness';

let db: PGlite;
let ana: string;
let beto: string;
const TOKEN = 'fcm-token-de-prueba-0123456789';

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, { handle: 'ana' });
  beto = await createUser(db, { handle: 'beto' });
});
afterAll(async () => {
  await db.close();
});

type Tx = Parameters<Parameters<PGlite['transaction']>[0]>[0];
/** Dueño del token, consultado como administrador sin salir de la transacción del usuario. */
async function owner(tx: Tx): Promise<string | null> {
  await tx.exec('reset role');
  const r = await tx.query<{ user_id: string }>('select user_id from public.push_tokens where token = $1', [TOKEN]);
  await tx.exec('set local role authenticated');
  return r.rows[0]?.user_id ?? null;
}
const as = (tx: Tx, uid: string) => tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);

it('los tokens solo se tocan por RPC; nadie lee la tabla', async () => {
  await asUser(db, ana, async (tx) => {
    await tx.query('select public.register_push_token($1)', [TOKEN]);
    expect(await owner(tx)).toBe(ana);
    await expectFailure(tx, 'select token from public.push_tokens', [], /permission denied/);
    await expectFailure(tx, `insert into public.push_tokens (token, user_id) values ('otro-token-de-prueba-000000', $1)`, [ana], /permission denied/);
  });
  await asUser(db, null, (tx) => expectFailure(tx, 'select public.register_push_token($1)', [TOKEN], /permission denied|not authenticated/));
});

it('el dispositivo pasa a la última cuenta y solo su dueño lo desregistra', async () => {
  await asUser(db, ana, async (tx) => {
    await tx.query('select public.register_push_token($1)', [TOKEN]);
    await as(tx, beto);
    await tx.query('select public.register_push_token($1)', [TOKEN]);
    expect(await owner(tx)).toBe(beto);
    await as(tx, ana);
    await tx.query('select public.unregister_push_token($1)', [TOKEN]);
    expect(await owner(tx)).toBe(beto);
    await as(tx, beto);
    await tx.query('select public.unregister_push_token($1)', [TOKEN]);
    expect(await owner(tx)).toBeNull();
  });
});

it('crear una notificación no falla aunque no haya pg_net ni Vault', async () => {
  await db.query('insert into public.push_tokens (token, user_id) values ($1, $2)', [TOKEN, ana]);
  await db.query(`insert into public.notifications (user_id, kind, title) values ($1, 'friend_request', 'Hola')`, [ana]);
  expect((await db.query('select 1 from public.notifications where user_id = $1', [ana])).rows).toHaveLength(1);
});
