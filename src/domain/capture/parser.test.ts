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

// Hoy: lunes 16 de noviembre de 2026 en Bogotá.
describe('frases naturales en español', () => {
  it('«cada lunes», «todos los martes» y «los jueves» repiten cada semana desde el próximo', () => {
    expect(parse('Sacar la basura cada lunes').action).toMatchObject({ title: 'Sacar la basura', recurrence: 'weekly', day: '2026-11-16' });
    expect(parse('Clase de inglés todos los martes a las 18:00').action).toMatchObject({ title: 'Clase de inglés', recurrence: 'weekly', day: '2026-11-17', time: '18:00' });
    expect(parse('Regar plantas los jueves').action).toMatchObject({ title: 'Regar plantas', recurrence: 'weekly', day: '2026-11-19' });
  });

  it('los hábitos guardan los días de la semana', () => {
    expect(parse('hábito Correr cada lunes y jueves 30 min').action).toMatchObject({ type: 'create_habit', title: 'Correr', days: [1, 4], minutes: 30 });
    expect(parse('hábito Meditar de lunes a viernes').action).toMatchObject({ days: [1, 2, 3, 4, 5], title: 'Meditar' });
    expect(parse('hábito Pasear los fines de semana').action).toMatchObject({ days: [0, 6], title: 'Pasear' });
  });

  it('plazos: «antes del viernes» es el jueves; «para el / hasta el viernes», el viernes', () => {
    expect(parse('Entregar informe antes del viernes').action).toMatchObject({ title: 'Entregar informe', day: '2026-11-19' });
    expect(parse('Pagar la luz para el viernes').action).toMatchObject({ title: 'Pagar la luz', day: '2026-11-20' });
    expect(parse('Revisar contrato hasta el miércoles').action).toMatchObject({ title: 'Revisar contrato', day: '2026-11-18' });
  });

  it('fechas relativas habituales', () => {
    expect(parse('Ordenar el cuarto este fin de semana').action).toMatchObject({ title: 'Ordenar el cuarto', day: '2026-11-21' });
    expect(parse('Llamar al banco la próxima semana').action).toMatchObject({ title: 'Llamar al banco', day: '2026-11-23' });
    expect(parse('Renovar pasaporte la semana que viene').action).toMatchObject({ day: '2026-11-23' });
    expect(parse('Declarar impuestos en 2 semanas').action).toMatchObject({ day: '2026-11-30' });
    expect(parse('Cerrar cuentas a fin de mes').action).toMatchObject({ title: 'Cerrar cuentas', day: '2026-11-30' });
    expect(parse('Dentista el próximo viernes').action).toMatchObject({ title: 'Dentista', day: '2026-11-20' });
  });

  it('horas habladas sin confundir «de la mañana» con mañana', () => {
    expect(parse('Gimnasio a las 7 de la mañana').action).toMatchObject({ title: 'Gimnasio', day: '2026-11-16', time: '07:00' });
    expect(parse('Cena mañana a las 8 de la noche').action).toMatchObject({ title: 'Cena', day: '2026-11-17', time: '20:00' });
    expect(parse('Reunión el martes a las 5 y media de la tarde').action).toMatchObject({ title: 'Reunión', day: '2026-11-17', time: '17:30' });
    expect(parse('Llamar a mamá a las 6 y cuarto').action).toMatchObject({ time: '06:15' });
    expect(parse('Almorzar con Ana mañana al mediodía').action).toMatchObject({ title: 'Almorzar con Ana', day: '2026-11-17', time: '12:00' });
  });

  it('duraciones habladas', () => {
    expect(parse('Leer media hora').action).toMatchObject({ title: 'Leer', minutes: 30 });
    expect(parse('Estudiar hora y media').action).toMatchObject({ title: 'Estudiar', minutes: 90 });
    expect(parse('Estirar un cuarto de hora').action).toMatchObject({ title: 'Estirar', minutes: 15 });
    expect(parse('Repasar una hora').action).toMatchObject({ title: 'Repasar', minutes: 60 });
  });
});
