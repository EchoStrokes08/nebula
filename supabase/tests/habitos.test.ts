import type { PGlite } from '@electric-sql/pglite';

import { asUser, createTestDb, createUser, expectFailure } from './harness';

let db: PGlite;
let ana: string;
let ben: string;
let habitId: string;

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, { handle: 'ana' });
  ben = await createUser(db, { handle: 'ben' });
  // Datos de partida creados como superusuario (asUser revierte su transacción al terminar).
  const { rows } = await db.query<{ id: string }>(
    `insert into public.habits (user_id, name, kind, unit, start_day) values ($1, 'Inglés', 'duration', 'min', '2026-11-01') returning id`,
    [ana],
  );
  habitId = rows[0]!.id;
  await db.query(`insert into public.habit_targets (habit_id, valid_from, period, target) values ($1, '2026-11-01', 'day', 30)`, [habitId]);
});
afterAll(async () => {
  await db.close();
});

describe('hábitos (F04-001)', () => {
  it('el propietario crea, registra y lee sus hábitos', async () => {
    await asUser(db, ana, async (tx) => {
      await tx.query(`insert into public.habit_logs (habit_id, day_key, value) values ($1, '2026-11-10', 20)`, [habitId]);
      const { rows } = await tx.query<{ value: string }>('select value from public.habit_logs where habit_id = $1', [habitId]);
      expect(rows.map((r) => Number(r.value))).toEqual([20]);
    });
  });

  it('otro usuario no ve ni puede registrar en hábitos ajenos', async () => {
    await asUser(db, ben, async (tx) => {
      expect((await tx.query('select * from public.habits')).rows).toHaveLength(0);
      expect((await tx.query('select * from public.habit_targets')).rows).toHaveLength(0);
    });
    await expect(
      asUser(db, ben, (tx) =>
        tx.query(`insert into public.habit_logs (habit_id, day_key, value) values ($1, '2026-11-10', 999)`, [habitId]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db, ben, (tx) =>
        tx.query(`insert into public.habit_targets (habit_id, valid_from, period, target) values ($1, '2026-11-20', 'day', 1)`, [habitId]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('las versiones de objetivo pasadas no se modifican; la de hoy sí (historial íntegro)', async () => {
    await asUser(db, ana, async (tx) => {
      const past = await tx.query(`update public.habit_targets set target = 5 where habit_id = $1 and valid_from = '2026-11-01'`, [habitId]);
      expect(past.affectedRows).toBe(0);
      await tx.query(`insert into public.habit_targets (habit_id, valid_from, period, target) values ($1, current_date, 'day', 45)`, [habitId]);
      const today = await tx.query(`update public.habit_targets set target = 50 where habit_id = $1 and valid_from = current_date`, [habitId]);
      expect(today.affectedRows).toBe(1);
    });
    const { rows } = await db.query<{ target: string }>(`select target from public.habit_targets where habit_id = $1 and valid_from = '2026-11-01'`, [habitId]);
    expect(Number(rows[0]!.target)).toBe(30);
  });

  it('rechaza registros en el futuro o antes del inicio', async () => {
    await expect(
      asUser(db, ana, (tx) =>
        tx.query(`insert into public.habit_logs (habit_id, day_key, value) values ($1, current_date + 5, 10)`, [habitId]),
      ),
    ).rejects.toThrow(/futuro/);
    await expect(
      asUser(db, ana, (tx) =>
        tx.query(`insert into public.habit_logs (habit_id, day_key, value) values ($1, '2026-10-01', 10)`, [habitId]),
      ),
    ).rejects.toThrow(/anterior al inicio/);
  });

  it('el client_id evita duplicados al reintentar sin conexión', async () => {
    await asUser(db, ana, async (tx) => {
      const cid = '11111111-1111-1111-1111-111111111111';
      await tx.query(`insert into public.habit_logs (habit_id, day_key, value, client_id) values ($1, '2026-11-11', 10, $2)`, [habitId, cid]);
      await expectFailure(
        tx,
        `insert into public.habit_logs (habit_id, day_key, value, client_id) values ($1, '2026-11-11', 10, $2)`,
        [habitId, cid],
        /duplicate key/,
      );
    });
  });

  it('los tipos de cantidad exigen unidad', async () => {
    await expect(
      asUser(db, ana, (tx) => tx.query(`insert into public.habits (name, kind) values ('Agua', 'quantity')`)),
    ).rejects.toThrow(/habits_unit_required/);
  });
});

describe('creación atómica (create_habit)', () => {
  it('crea hábito y objetivo juntos, o ninguno', async () => {
    await asUser(db, ben, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(`select public.create_habit('Leer', 'binary', 'day', 1, '2026-11-17') as id`);
      const t = await tx.query('select * from public.habit_targets where habit_id = $1', [rows[0]!.id]);
      expect(t.rows).toHaveLength(1);
      // Objetivo inválido: falla todo y no queda un hábito huérfano.
      await expectFailure(tx, `select public.create_habit('Mal', 'binary', 'day', -1, '2026-11-17')`, [], /check/i);
      const orphans = await tx.query(`select * from public.habits h where name = 'Mal'`);
      expect(orphans.rows).toHaveLength(0);
    });
  });
});
