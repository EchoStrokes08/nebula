import type { PGlite } from '@electric-sql/pglite';

import { createTestDb, createUser } from './harness';

let db: PGlite;
let ana: string;
let ben: string;
let cris: string;
let extra: string;

/** Primera fila (falla si no hay ninguna). */
async function one<T>(user: string, sql: string, params: unknown[] = []): Promise<T> {
  const rows = await as<T>(user, sql, params);
  if (!rows[0]) throw new Error('Sin filas');
  return rows[0];
}

async function as<T>(user: string, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user]);
    return (await tx.query<T>(sql, params)).rows;
  });
}
const today = async () => (await db.query<{ d: string }>(`select current_date::text as d`)).rows[0]!.d;
const befriend = async (a: string, b: string) => {
  const { id } = await one<{ id: string }>(a, `select public.send_friend_request($1) as id`, [b]);
  await as(b, `select public.respond_friend_request($1, true)`, [id]);
};
const focus = (user: string, day: string, minutes: number, createdAt?: string) =>
  db.query(
    `insert into public.focus_sessions (user_id, mode, planned_minutes, started_at, ended_at, focused_seconds, status, created_at)
     values ($1, 'custom', $3, ($2::date + time '10:00') at time zone 'UTC', ($2::date + time '10:00') at time zone 'UTC' + make_interval(mins => $3), $3 * 60, 'completed', coalesce($4::timestamptz, now()))`,
    [user, day, minutes, createdAt ?? null],
  );
const standings = (c: string, nowSql = 'now()') =>
  db.query<{ user_id: string; score: string; rank: number; value: string; days_active: number; status: string }>(`select * from public.compute_standings($1, ${nowSql}) order by rank`, [c]).then((r) => r.rows);

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, { handle: 'ana', display_name: 'Ana' });
  ben = await createUser(db, { handle: 'ben', display_name: 'Ben' });
  cris = await createUser(db, { handle: 'cris', display_name: 'Cris' });
  extra = await createUser(db, { handle: 'extra', display_name: 'Extra' });
  await befriend(ana, ben);
  await befriend(ana, cris);
});
afterAll(async () => {
  await db.close();
});

describe('retos (F08)', () => {
  it('reto equilibrado 10 h vs 5 h: gana el mayor % de su objetivo (ejemplo del prompt)', async () => {
    const d = await today();
    const { id } = await one<{ id: string }>(ana, `select public.create_challenge($1::jsonb) as id`, [
      JSON.stringify({ kind: 'duel', title: 'Estudio', metric: 'percent', source: 'focus', unit: 'min', starts_on: d, ends_on: d, tz: 'UTC', invitees: [{ user_id: ben }], my_target: 600 }),
    ]);
    await as(ben, `select public.accept_challenge($1, 300)`, [id]);
    await db.query(`select public.challenge_refresh($1)`, [id]); // empieza hoy
    await focus(ana, d, 360); // 6 h de 10 → 60 %
    await focus(ben, d, 240); // 4 h de 5 → 80 %
    const s = await standings(id);
    expect(s.map((x) => [x.user_id, Number(x.score), x.rank])).toEqual([
      [ben, 80, 1],
      [ana, 60, 2],
    ]);
    // Ana no puede cambiar su objetivo una vez empezado (bloqueado)
    await expect(as(ana, `select public.accept_challenge($1, 100)`, [id])).rejects.toThrow(/ya no admite cambios/);
    // Cierre tras la gracia: resultados y ganador
    await db.query(`select public.challenge_refresh($1, now() + interval '3 days')`, [id]);
    const res = (await db.query<{ user_id: string; winner: boolean }>(`select user_id, winner from public.challenge_results where challenge_id = $1 order by rank`, [id])).rows;
    expect(res).toEqual([{ user_id: ben, winner: true }, { user_id: ana, winner: false }]);
    expect((await as<{ kind: string }>(ben, `select kind from public.notifications where kind like 'challenge%' order by created_at`)).map((n) => n.kind)).toEqual(
      expect.arrayContaining(['challenge_invite', 'challenge_started', 'challenge_finished']),
    );
  });

  it('el porcentaje se limita al tope (registrar de más no da ventaja infinita)', async () => {
    const d = await today();
    const { id } = await one<{ id: string }>(ana, `select public.create_challenge($1::jsonb) as id`, [
      JSON.stringify({ kind: 'duel', title: 'Tope', metric: 'percent', source: 'focus', unit: 'min', starts_on: d, ends_on: d, tz: 'UTC', invitees: [{ user_id: ben }], my_target: 30 }),
    ]);
    await as(ben, `select public.accept_challenge($1, 30)`, [id]);
    await db.query(`select public.challenge_refresh($1)`, [id]);
    const s = await standings(id);
    expect(Number(s.find((x) => x.user_id === ana)!.score)).toBe(100); // 6 h registradas antes sobre 30 min → 100 %, no 1200 %
  });

  it('solo amigos; duelo de dos; solo participantes ven la clasificación', async () => {
    const d = await today();
    await expect(
      as(ana, `select public.create_challenge($1::jsonb)`, [JSON.stringify({ kind: 'group', title: 'X', metric: 'sessions', source: 'focus', unit: 'min', starts_on: d, ends_on: d, invitees: [{ user_id: extra }] })]),
    ).rejects.toThrow(/amigos/);
    await expect(
      as(ana, `select public.create_challenge($1::jsonb)`, [JSON.stringify({ kind: 'duel', title: 'X', metric: 'sessions', source: 'focus', unit: 'min', starts_on: d, ends_on: d, invitees: [{ user_id: ben }, { user_id: cris }] })]),
    ).rejects.toThrow(/dos personas/);
    const { id } = await one<{ id: string }>(ana, `select public.create_challenge($1::jsonb) as id`, [
      JSON.stringify({ kind: 'group', title: 'Sesiones', metric: 'sessions', source: 'focus', unit: 'min', starts_on: d, ends_on: d, invitees: [{ user_id: ben }] }),
    ]);
    await expect(as(extra, `select * from public.challenge_standings($1)`, [id])).rejects.toThrow(/no autorizado/);
    expect(await as(extra, `select * from public.challenges where id = $1`, [id])).toHaveLength(0);
    // Nadie escribe resultados ni participaciones directamente
    await expect(as(ana, `insert into public.challenge_results (challenge_id, user_id, rank, value, score, days_active, winner) values ($1, $2, 1, 999, 999, 9, true)`, [id, ana])).rejects.toThrow(/permission denied/);
    await expect(as(ana, `update public.challenge_participants set personal_target = 1 where challenge_id = $1`, [id])).rejects.toThrow(/permission denied/);
  });

  it('sin aceptaciones suficientes al empezar, se cancela', async () => {
    const d = await today();
    const { id } = await one<{ id: string }>(ana, `select public.create_challenge($1::jsonb) as id`, [
      JSON.stringify({ kind: 'group', title: 'Solo', metric: 'sessions', source: 'focus', unit: 'min', starts_on: d, ends_on: d, invitees: [{ user_id: cris }] }),
    ]);
    // El día de inicio todavía se puede aceptar: no se cancela hasta que termina.
    expect((await db.query<{ s: string }>(`select public.challenge_refresh($1) as s`, [id])).rows[0]!.s).toBe('pending');
    const s = (await db.query<{ s: string }>(`select public.challenge_refresh($1, now() + interval '1 day') as s`, [id])).rows[0]!.s;
    expect(s).toBe('cancelled');
  });

  it('un reto que empieza hoy arranca al aceptar el último invitado, sin esperar a la tarea programada', async () => {
    const d = await today();
    const { id } = await one<{ id: string }>(ana, `select public.create_challenge($1::jsonb) as id`, [
      JSON.stringify({ kind: 'group', title: 'Hoy', metric: 'sessions', source: 'focus', unit: 'min', starts_on: d, ends_on: d, invitees: [{ user_id: ben }, { user_id: cris }] }),
    ]);
    await as(ben, `select public.accept_challenge($1)`, [id]);
    // Cris aún no ha respondido: sigue pendiente aunque ya haya dos aceptados.
    expect((await db.query<{ s: string }>(`select status::text as s from public.challenges where id = $1`, [id])).rows[0]!.s).toBe('pending');
    await as(cris, `select public.decline_challenge($1)`, [id]);
    expect((await db.query<{ s: string }>(`select status::text as s from public.challenges where id = $1`, [id])).rows[0]!.s).toBe('active');
  });

  it('hábito vinculado: no cuentan los registros retroactivos ni los tardíos', async () => {
    const d = await today();
    const hb = (await db.query<{ id: string }>(`insert into public.habits (user_id, name, kind, start_day) values ($1, 'Leer', 'binary', current_date - 30) returning id`, [ben])).rows[0]!.id;
    const ha = (await db.query<{ id: string }>(`insert into public.habits (user_id, name, kind, start_day) values ($1, 'Leer', 'binary', current_date - 30) returning id`, [ana])).rows[0]!.id;
    const { id } = await one<{ id: string }>(ana, `select public.create_challenge($1::jsonb) as id`, [
      JSON.stringify({ kind: 'duel', title: 'Lectura', metric: 'consistency', source: 'habit', unit: 'días', starts_on: d, ends_on: d, tz: 'UTC', invitees: [{ user_id: ben }], my_habit_id: ha }),
    ]);
    await as(ben, `select public.accept_challenge($1, null, $2)`, [id, hb]);
    await db.query(`select public.challenge_refresh($1)`, [id]);
    await db.query(`insert into public.habit_logs (habit_id, user_id, day_key, value) values ($1, $2, current_date, 1)`, [ha, ana]);
    // Ben lo registra 5 días después (retroactivo): no cuenta
    await db.query(`insert into public.habit_logs (habit_id, user_id, day_key, value, created_at) values ($1, $2, current_date, 1, now() + interval '5 days')`, [hb, ben]);
    const s = await standings(id, `now() + interval '6 days'`);
    expect(s.map((x) => [x.user_id, x.days_active])).toEqual([
      [ana, 1],
      [ben, 0],
    ]);
  });

  it('cooperativo distribuido: total y mínimo por persona; se cierra al lograrlo', async () => {
    const d = await today();
    const { id } = await one<{ id: string }>(ana, `select public.create_challenge($1::jsonb) as id`, [
      JSON.stringify({ kind: 'cooperative', title: '30 sesiones', metric: 'quantity', source: 'focus', unit: 'min', starts_on: d, ends_on: d, tz: 'UTC', coop_mode: 'distributed', coop_target: 60, coop_min_each: 20, invitees: [{ user_id: cris }] }),
    ]);
    await as(cris, `select public.accept_challenge($1)`, [id]);
    await db.query(`select public.challenge_refresh($1)`, [id]);
    await focus(cris, d, 15);
    // Ana ya tiene minutos de pruebas anteriores (> 60): el total supera 60 pero Cris no llega a su mínimo
    expect((await db.query<{ s: string }>(`select public.challenge_refresh($1) as s`, [id])).rows[0]!.s).toBe('active');
    await focus(cris, d, 10);
    expect((await db.query<{ s: string }>(`select public.challenge_refresh($1) as s`, [id])).rows[0]!.s).toBe('finished');
    expect((await db.query<{ outcome: string }>(`select outcome from public.challenges where id = $1`, [id])).rows[0]!.outcome).toBe('achieved');
  });

  it('empates: compartidos o desempate por constancia (más días activos)', async () => {
    const d = await today();
    const p1 = await createUser(db, { handle: 'tie_uno', display_name: 'Uno' });
    const p2 = await createUser(db, { handle: 'tie_dos', display_name: 'Dos' });
    await befriend(p1, p2);
    // Mismo total (60 min): p1 en dos días, p2 en uno.
    const tomorrow = (await db.query<{ d: string }>(`select (current_date + 1)::text as d`)).rows[0]!.d;
    await focus(p1, d, 30);
    await focus(p1, tomorrow, 30);
    await focus(p2, d, 60);
    const mk = async (tie: string) => {
      const { id } = await one<{ id: string }>(p1, `select public.create_challenge($1::jsonb) as id`, [
        JSON.stringify({ kind: 'duel', title: 'Empate', metric: 'quantity', source: 'focus', unit: 'min', starts_on: d, ends_on: tomorrow, tz: 'UTC', tie_rule: tie, invitees: [{ user_id: p2 }] }),
      ]);
      await as(p2, `select public.accept_challenge($1)`, [id]);
      await db.query(`select public.challenge_refresh($1)`, [id]);
      return standings(id, `now() + interval '1 day'`);
    };
    const shared = await mk('shared');
    expect(shared.map((x) => [Number(x.score), x.rank])).toEqual([[60, 1], [60, 1]]);
    const byDays = await mk('consistency');
    expect(byDays.map((x) => [x.user_id, x.rank])).toEqual([[p1, 1], [p2, 2]]);
  });
});

describe('unidad común (F08-017)', () => {
  it('en «cantidad total» con hábitos, el hábito debe usar la unidad del reto', async () => {
    const d = await today();
    const u1 = await createUser(db, { handle: 'km_uno' });
    const u2 = await createUser(db, { handle: 'km_dos' });
    await befriend(u1, u2);
    const km1 = (await db.query<{ id: string }>(`insert into public.habits (user_id, name, kind, unit) values ($1, 'Correr', 'quantity', 'km') returning id`, [u1])).rows[0]!.id;
    const pages = (await db.query<{ id: string }>(`insert into public.habits (user_id, name, kind, unit) values ($1, 'Leer', 'quantity', 'páginas') returning id`, [u2])).rows[0]!.id;
    const km2 = (await db.query<{ id: string }>(`insert into public.habits (user_id, name, kind, unit) values ($1, 'Correr', 'quantity', 'KM') returning id`, [u2])).rows[0]!.id;
    const { id } = await one<{ id: string }>(u1, `select public.create_challenge($1::jsonb) as id`, [
      JSON.stringify({ kind: 'duel', title: 'Km', metric: 'quantity', source: 'habit', unit: 'km', starts_on: d, ends_on: d, invitees: [{ user_id: u2 }], my_habit_id: km1 }),
    ]);
    await expect(as(u2, `select public.accept_challenge($1, null, $2)`, [id, pages])).rejects.toThrow(/misma unidad/);
    await as(u2, `select public.accept_challenge($1, null, $2)`, [id, km2]);
  });
});
