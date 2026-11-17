import { parseCapture } from './parser';
const now = new Date('2026-11-17T02:00:00Z'); // lunes 16 en Bogotá
const parse = (text: string) => parseCapture(text, now, 'America/Bogota');
it('captura tareas con fecha local, hora y duración', () => {
  expect(parse('tarea Revisar informe mañana a las 9:30 durante 45 min urgente').action).toEqual({ type: 'create_task', title: 'Revisar informe', day: '2026-11-17', time: '09:30', minutes: 45, priority: 3, recurrence: null });
});
it('distingue pasado mañana, recurrencias y horas de 12 horas', () => {
  expect(parse('Llamar pasado mañana a las 12 pm').action).toMatchObject({ day: '2026-11-18', time: '12:00' });
  expect(parse('Leer cada día 1,5 horas').action).toMatchObject({ title: 'Leer', minutes: 90, recurrence: 'daily', day: '2026-11-16' });
});
it('captura hábitos y metas sin inventar una fecha', () => {
  expect(parse('hábito Leer cada día 20 min').action).toMatchObject({ type: 'create_habit', title: 'Leer', minutes: 20 });
  expect(parse('meta Terminar tesis').action).toMatchObject({ type: 'create_goal', title: 'Terminar tesis', day: null });
});
it('rechaza fechas imposibles, horas fuera de rango y duraciones excesivas', () => {
  for (const t of ['Reunión 2026-02-30', 'Leer a las 28:00', 'Leer 900 min', '']) expect(parse(t).action).toBeNull();
});
it('exige datos completos de un evento', () => {
  expect(parse('evento Reunión mañana').action).toBeNull();
  expect(parse('evento Reunión mañana a las 10 durante 30 min').action).toMatchObject({ type: 'create_event', title: 'Reunión', day: '2026-11-17', time: '10:00', minutes: 30 });
});
it('el próximo día de semana se calcula sobre el día civil', () => {
  expect(parse('Comprar el martes').action).toMatchObject({ day: '2026-11-17', title: 'Comprar' });
});
