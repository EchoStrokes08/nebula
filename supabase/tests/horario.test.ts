import type { PGlite } from '@electric-sql/pglite';

import { asUser, createTestDb, createUser, expectFailure } from './harness';

let db: PGlite;
let ana: string;
let ben: string;

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, { handle: 'ana' });
  ben = await createUser(db, { handle: 'ben' });
});
afterAll(async () => {
  await db.close();
});

describe('horario: tu día menos cuando estás ocupado', () => {
  it('guarda día, bloques ocupados y franjas libres de una vez, y sustituye lo anterior', async () => {
    await asUser(db, ana, async (tx) => {
      await tx.query(`insert into public.availability_windows (weekday, start_time, end_time) values (3, '10:00', '11:00')`);
      const days = [{ weekday: 1, start: '07:00', end: '22:00' }];
      const busy = [{ label: 'Universidad', weekdays: [1, 2], start: '08:00', end: '12:00' }];
      const windows = [{ weekday: 1, start: '07:00', end: '08:00' }, { weekday: 1, start: '12:00', end: '22:00' }];
      await tx.query('select public.save_schedule($1, $2, $3)', [JSON.stringify(days), JSON.stringify(busy), JSON.stringify(windows)]);
      expect((await tx.query('select * from public.day_hours')).rows).toHaveLength(1);
      expect((await tx.query<{ weekdays: number[] }>('select weekdays from public.busy_blocks')).rows[0]!.weekdays).toEqual([1, 2]);
      expect((await tx.query('select * from public.availability_windows')).rows).toHaveLength(2);
    });
    await asUser(db, ben, async (tx) => {
      expect((await tx.query('select * from public.busy_blocks')).rows).toHaveLength(0);
      expect((await tx.query('select * from public.day_hours')).rows).toHaveLength(0);
    });
  });

  it('valida los bloques ocupados', async () => {
    await asUser(db, ana, async (tx) => {
      await expectFailure(tx, `insert into public.busy_blocks (label, weekdays, start_time, end_time) values ('X', '{1}', '12:00', '08:00')`, [], /check/);
      await expectFailure(tx, `insert into public.busy_blocks (label, weekdays, start_time, end_time) values ('X', '{9}', '08:00', '09:00')`, [], /check/);
      await expectFailure(tx, `insert into public.busy_blocks (label, weekdays, start_time, end_time) values ('  ', '{1}', '08:00', '09:00')`, [], /check/);
    });
  });
});
