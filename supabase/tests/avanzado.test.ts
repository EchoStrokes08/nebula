import type { PGlite } from '@electric-sql/pglite';
import { asUser, createTestDb, createUser, expectFailure } from './harness';
let db: PGlite; let ana: string; let ben: string;
beforeAll(async () => { db = await createTestDb(); ana = await createUser(db); ben = await createUser(db); });
afterAll(async () => { await db.close(); });
it('diario privado: ni amigos ni anónimos pueden leer o escribir como otra persona', async () => {
  await db.query("insert into journal_entries(user_id, day_key, achievements) values ($1, current_date, 'privado')", [ana]);
  await asUser(db, ben, async (tx) => {
    expect((await tx.query('select * from journal_entries')).rows).toHaveLength(0);
    await expectFailure(tx, "insert into journal_entries(user_id, day_key) values ($1, current_date)", [ana], /row-level security/);
    expect((await tx.query("update journal_entries set achievements='hack' where user_id=$1 returning id", [ana])).rows).toHaveLength(0);
  });
  await asUser(db, null, async (tx) => { await expectFailure(tx, 'select * from journal_entries', [], /permission denied/); });
});
it('exige consentimiento y aplica el límite de IA en el servidor', async () => {
  await asUser(db, ana, async (tx) => {
    await expectFailure(tx, 'select consume_ai_request()', [], /IA desactivada/);
    await tx.query('update user_preferences set ai_enabled=true where user_id=$1', [ana]);
    for (let i = 0; i < 20; i++) expect((await tx.query<{ ok: boolean }>('select consume_ai_request() as ok')).rows[0]?.ok).toBe(true);
    expect((await tx.query<{ ok: boolean }>('select consume_ai_request() as ok')).rows[0]?.ok).toBe(false);
    await expectFailure(tx, 'update ai_daily_usage set requests=0', [], /permission denied/);
  });
});
it('la privacidad y la IA de una cuenta nueva requieren elección explícita', async () => {
  const p = (await db.query<{ visibility: string; ai_enabled: boolean }>('select p.visibility, u.ai_enabled from profiles p join user_preferences u on p.id=u.user_id where p.id=$1', [ana])).rows[0];
  expect(p).toEqual({ visibility: 'private', ai_enabled: false });
});
it('importa de forma atómica y reimporta sin duplicar', async () => {
  await asUser(db, ana, async (tx) => {
    const events = [{ external_id: 'same', title: 'Reunión', starts_at: '2026-11-18T15:00:00Z', ends_at: '2026-11-18T16:00:00Z', all_day: false, tz: 'UTC' }];
    await tx.query("select import_calendar('Trabajo','ics',$1)", [JSON.stringify(events)]);
    events[0]!.title = 'Actualizada';
    await tx.query("select import_calendar('Trabajo','ics',$1)", [JSON.stringify(events)]);
    const rows = (await tx.query<{ title: string }>('select title from calendar_events where user_id=$1', [ana])).rows;
    expect(rows).toEqual([{ title: 'Actualizada' }]);
    await expectFailure(tx, "select import_calendar('Trabajo','ics',$1)", [JSON.stringify([{ ...events[0], ends_at: '2026-11-17T16:00:00Z' }])], /calendar_events_order/);
    expect((await tx.query('select * from integrations')).rows).toHaveLength(1);
  });
});
it('las integraciones de otra cuenta no se pueden usar como destino', async () => {
  const id = (await db.query<{ id: string }>("insert into integrations(user_id,provider,name) values($1,'ics','Privado') returning id", [ana])).rows[0]!.id;
  await asUser(db, ben, async (tx) => {
    expect((await tx.query('select * from integrations where id=$1', [id])).rows).toHaveLength(0);
    await expectFailure(tx, "insert into calendar_events(user_id,title,starts_at,ends_at,integration_id) values ($1,'Ajeno',now(),now()+interval '1 hour',$2)", [ben,id], /row-level security/);
  });
});
it('salas: invitación solo entre amigos y arranque autoritativo', async () => {
  const low = ana < ben ? ana : ben, high = ana < ben ? ben : ana;
  await db.query('insert into friendships(user_a,user_b) values($1,$2) on conflict do nothing',[low,high]);
  await asUser(db, ana, async (tx) => {
    const room = (await tx.query<{ id: string }>("select create_focus_room('Juntos',25,$1::uuid[]) as id",[[ben]])).rows[0]!.id;
    const started = (await tx.query<{ start: Date }>('select start_focus_room($1) as start',[room])).rows[0]!.start;
    expect(started).toBeTruthy();
    await expectFailure(tx,'select start_focus_room($1)',[room],/no se puede iniciar/);
    const members = (await tx.query('select * from focus_room_members where room_id=$1',[room])).rows;
    expect(members).toHaveLength(2);
    await expectFailure(tx,"insert into focus_room_members values($1,$2,'accepted')",[room,ana],/permission denied/);
  });
  const stranger=await createUser(db);
  await asUser(db,stranger,async(tx)=>{ expect((await tx.query('select * from focus_rooms')).rows).toHaveLength(0); await expectFailure(tx,"select create_focus_room('Intruso',25,$1::uuid[])",[[ana]],/solo puedes invitar a amigos/); });
});
it('solo el servidor puede devolver una consulta de IA fallida', async () => {
  await db.query('update user_preferences set ai_enabled=true where user_id=$1', [ben]);
  await db.query("insert into ai_daily_usage(user_id, day, requests) values ($1, current_date, 5) on conflict (user_id, day) do update set requests = 5", [ben]);
  await asUser(db, ben, async (tx) => {
    await expectFailure(tx, 'select refund_ai_request($1)', [ben], /permission denied/);
  });
  await db.transaction(async (tx) => {
    await tx.exec('set local role service_role');
    await tx.query('select refund_ai_request($1)', [ben]);
  });
  expect((await db.query<{ requests: number }>('select requests from ai_daily_usage where user_id=$1 and day=current_date', [ben])).rows[0]?.requests).toBe(4);
});
it('solo el servidor ve y registra la salud de los modelos de IA', async () => {
  await asUser(db, ben, async (tx) => {
    await expectFailure(tx, "select record_ai_attempt('groq:x', 'ok', 100)", [], /permission denied/);
    await expectFailure(tx, 'select * from ai_model_health', [], /permission denied/);
  });
  await db.transaction(async (tx) => {
    await tx.exec('set local role service_role');
    await tx.query("select record_ai_attempt('groq:x', 'ok', 100)");
    await tx.query("select record_ai_attempt('groq:x', 'ok', 300)");
    await tx.query("select record_ai_attempt('groq:x', 'busy', 900)");
  });
  const row = (await db.query<{ ok_count: number; busy_count: number; ms_total: number }>("select ok_count, busy_count, ms_total::int as ms_total from ai_model_health where model='groq:x'")).rows[0];
  expect(row).toEqual({ ok_count: 2, busy_count: 1, ms_total: 400 });
});
