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

it('el permiso renovable de Google solo lo toca el servidor', async () => {
  await db.query(`insert into public.google_calendar_tokens (user_id, refresh_token) values ($1, '1//refresh-token-de-prueba')`, [ana]);
  await asUser(db, ana, async (tx) => {
    await expectFailure(tx, 'select refresh_token from public.google_calendar_tokens', [], /permission denied/);
  });
  await asUser(db, ana, async (tx) => {
    await expectFailure(tx, `insert into public.google_calendar_tokens (user_id, refresh_token) values ($1, '1//otro-token-de-prueba')`, [ana], /permission denied/);
  });
});
