import type { PGlite } from '@electric-sql/pglite';

import { asUser, createTestDb, createUser, expectFailure } from './harness';

let db: PGlite;
let ana: string;
let ben: string;
let benHabit: string;

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, { handle: 'ana' });
  ben = await createUser(db, { handle: 'ben' });
  benHabit = (await db.query<{ id: string }>(`insert into public.habits (user_id, name, kind) values ($1, 'Leer', 'binary') returning id`, [ben])).rows[0]!.id;
});
afterAll(async () => {
  await db.close();
});

describe('agenda y enfoque (F06)', () => {
  it('eventos: orden de fechas, duración máxima y aislamiento', async () => {
    await asUser(db, ana, async (tx) => {
      await tx.query(`insert into public.calendar_events (title, starts_at, ends_at) values ('Clase', '2026-11-18 09:00Z', '2026-11-18 10:30Z')`);
      await expectFailure(tx, `insert into public.calendar_events (title, starts_at, ends_at) values ('Al revés', '2026-11-18 10:00Z', '2026-11-18 09:00Z')`, [], /calendar_events_order/);
      await expectFailure(tx, `insert into public.calendar_events (title, starts_at, ends_at) values ('Eterno', '2026-11-01Z', '2026-12-01Z')`, [], /calendar_events_max_len/);
    });
    await asUser(db, ben, async (tx) => {
      expect((await tx.query('select * from public.calendar_events')).rows).toHaveLength(0);
    });
  });

  it('sesiones de enfoque: tiempo plausible y vínculos propios', async () => {
    await asUser(db, ana, async (tx) => {
      await tx.query(`insert into public.focus_sessions (mode, planned_minutes, started_at, ended_at, focused_seconds, status) values ('pomodoro', 25, '2026-11-18 09:00Z', '2026-11-18 09:25Z', 1500, 'completed')`);
      // 2 horas «enfocadas» en una sesión de 25 minutos: imposible
      await expectFailure(tx, `insert into public.focus_sessions (mode, planned_minutes, started_at, ended_at, focused_seconds, status) values ('pomodoro', 25, '2026-11-18 10:00Z', '2026-11-18 10:25Z', 7200, 'completed')`, [], /focus_sessions_plausible/);
      await expectFailure(tx, `insert into public.focus_sessions (mode, planned_minutes, started_at, habit_id) values ('custom', 30, now(), $1)`, [benHabit], /hábito no válido/);
    });
  });

  it('radar: solo sesiones propias', async () => {
    const benSession = (await db.query<{ id: string }>(`insert into public.focus_sessions (user_id, mode, planned_minutes, started_at) values ($1, 'custom', 30, now()) returning id`, [ben])).rows[0]!.id;
    await asUser(db, ana, async (tx) => {
      await tx.query(`insert into public.distraction_logs (kind, duration_minutes) values ('redes', 10)`);
      await expectFailure(tx, `insert into public.distraction_logs (kind, session_id) values ('ruido', $1)`, [benSession], /sesión no válida/);
    });
  });

  it('disponibilidad: franjas válidas', async () => {
    await asUser(db, ana, async (tx) => {
      await tx.query(`insert into public.availability_windows (weekday, start_time, end_time) values (1, '09:00', '13:00')`);
      await expectFailure(tx, `insert into public.availability_windows (weekday, start_time, end_time) values (1, '13:00', '09:00')`, [], /check/);
    });
  });
});
