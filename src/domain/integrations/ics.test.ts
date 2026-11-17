import { parseIcs } from './ics';
const calendar = (fields: string) => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\n${fields}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
it('lee fechas UTC, escapes y líneas plegadas', () => {
  const r = parseIcs(calendar('UID:abc\r\nSUMMARY:Una reunión\\,\r\n larga\r\nDTSTART:20261116T150000Z\r\nDTEND:20261116T160000Z'));
  expect(r.warnings).toEqual([]); expect(r.events[0]).toMatchObject({ external_id: 'abc', title: 'Una reunión,larga', starts_at: '2026-11-16T15:00:00.000Z', all_day: false });
});
it('omite zonas locales y recurrencias con explicación', () => {
  expect(parseIcs(calendar('UID:a\nSUMMARY:x\nDTSTART;TZID=Europe/Madrid:20261116T150000\nDTEND:20261116T160000Z')).warnings.length).toBe(1);
  expect(parseIcs(calendar('UID:a\nRRULE:FREQ=DAILY')).events).toEqual([]);
});
it('rechaza fechas normalizadas y rangos invertidos', () => {
  expect(parseIcs(calendar('UID:a\nSUMMARY:x\nDTSTART:20260230T150000Z\nDTEND:20260301T160000Z')).events).toEqual([]);
});
it('admite días completos con fin exclusivo', () => {
  expect(parseIcs(calendar('UID:a\nSUMMARY:Descanso\nDTSTART;VALUE=DATE:20261116\nDTEND;VALUE=DATE:20261117')).events[0]).toMatchObject({ all_day: true });
});
