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

describe('notas rápidas, frases propias y Google Calendar', () => {
  it('notas: reglas de hora y recordatorio, y aislamiento', async () => {
    await asUser(db, ana, async (tx) => {
      await tx.query(`insert into public.notes (text, color, day, at_time, remind) values ('Llamar al dentista', 'rosa', '2026-11-20', '10:30', true)`);
      await tx.query(`insert into public.notes (text) values ('Idea suelta')`);
      await expectFailure(tx, `insert into public.notes (text, at_time) values ('Sin día', '10:00')`, [], /notes_time_needs_day/);
      await expectFailure(tx, `insert into public.notes (text, day, remind) values ('Sin hora', '2026-11-20', true)`, [], /notes_remind_needs_time/);
      await expectFailure(tx, `insert into public.notes (text, color) values ('x', 'negro')`, [], /notes_color_check/);
      await expectFailure(tx, `insert into public.notes (text) values ('   ')`, [], /notes_text_check/);
    });
    await asUser(db, ben, async (tx) => {
      expect((await tx.query('select * from public.notes')).rows).toHaveLength(0);
    });
  });

  it('frases propias y frase principal', async () => {
    await asUser(db, ana, async (tx) => {
      const id = (await tx.query<{ id: string }>(`insert into public.motivation_phrases (text, author) values ('Hecho es mejor que perfecto', null) returning id`)).rows[0]!.id;
      await tx.query(`update public.user_preferences set featured_phrase = $1 where user_id = $2`, [`propia:${id}`, ana]);
      await expectFailure(tx, `update public.user_preferences set featured_phrase = 'otra cosa' where user_id = $1`, [ana], /featured_phrase/);
    });
    await asUser(db, ben, async (tx) => {
      expect((await tx.query('select * from public.motivation_phrases')).rows).toHaveLength(0);
    });
  });

  it('importa de Google y poda solo los eventos que ya no existen en su rango', async () => {
    let integration = '';
    await asUser(db, ana, async (tx) => {
      const events = [
        { external_id: 'g1', title: 'Clase', starts_at: '2026-11-20T09:00:00Z', ends_at: '2026-11-20T10:00:00Z', all_day: false, tz: 'Europe/Madrid' },
        { external_id: 'g2', title: 'Gimnasio', starts_at: '2026-11-21T18:00:00Z', ends_at: '2026-11-21T19:00:00Z', all_day: false, tz: 'Europe/Madrid' },
        { external_id: 'g3', title: 'Viejo', starts_at: '2026-10-01T18:00:00Z', ends_at: '2026-10-01T19:00:00Z', all_day: false, tz: 'Europe/Madrid' },
      ];
      expect((await tx.query<{ n: number }>(`select public.import_calendar('Google Calendar', 'google', $1::jsonb) as n`, [JSON.stringify(events)])).rows[0]!.n).toBe(3);
      integration = (await tx.query<{ id: string }>(`select id from public.integrations where provider = 'google'`)).rows[0]!.id;
      const pruned = (await tx.query<{ n: number }>(`select public.prune_calendar($1, '2026-11-01Z', '2027-01-01Z', array['g1']) as n`, [integration])).rows[0]!.n;
      expect(pruned).toBe(1);
      const left = (await tx.query<{ external_id: string; source: string }>(`select external_id, source from public.calendar_events order by external_id`)).rows;
      expect(left).toEqual([{ external_id: 'g1', source: 'google' }, { external_id: 'g3', source: 'google' }]);
    });
    await asUser(db, ben, async (tx) => {
      await expectFailure(tx, `select public.prune_calendar($1, '2026-01-01Z', '2027-01-01Z', '{}')`, [integration], /integración no encontrada/);
    });
  });
});
