import { routeForNotification } from './route';

const u = '123e4567-e89b-12d3-a456-426614174000';
it('cada notificación abre su pantalla', () => {
  expect(routeForNotification('nebula-weekly-2026-11-22')).toBe('/revision');
  expect(routeForNotification('focus-end')).toBe('/enfoque');
  expect(routeForNotification(`nebula-habit-${u}-2026-11-17`)).toBe(`/habito/${u}`);
  expect(routeForNotification(`nebula-task-${u}`)).toBe(`/tarea/${u}`);
  expect(routeForNotification(`nebula-event-${u}-1700000000000`)).toBe('/agenda');
  expect(routeForNotification('social-abc')).toBe('/notificaciones');
});
it('ids desconocidos o manipulados van a Hoy', () => {
  expect(routeForNotification('nebula-task-../../x')).toBe('/hoy');
  expect(routeForNotification(undefined)).toBe('/hoy');
});
