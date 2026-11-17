import { toDayKey as d } from '@/lib/dates';

import { analyzeDag, wouldCreateCycle } from './dag';
import { describeRecurrence, formatRecurrence, nextOccurrence, parseRecurrence } from './recurrence';

describe('recurrencia', () => {
  it('diaria, mensual (fin de mes) y semanal con días', () => {
    expect(nextOccurrence('FREQ=DAILY;INTERVAL=2', d('2026-11-30'))).toBe('2026-12-02');
    expect(nextOccurrence('FREQ=MONTHLY', d('2026-01-31'))).toBe('2026-02-28');
    expect(nextOccurrence('FREQ=WEEKLY', d('2026-11-18'))).toBe('2026-11-25');
    // lunes y miércoles: desde el lunes 16 → miércoles 18; desde el miércoles → lunes 23
    expect(nextOccurrence('FREQ=WEEKLY;BYDAY=MO,WE', d('2026-11-16'))).toBe('2026-11-18');
    expect(nextOccurrence('FREQ=WEEKLY;BYDAY=MO,WE', d('2026-11-18'))).toBe('2026-11-23');
    expect(nextOccurrence('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO', d('2026-11-16'))).toBe('2026-11-30');
  });

  it('ida y vuelta del formato y descripción', () => {
    const r = parseRecurrence('FREQ=WEEKLY;BYDAY=WE,MO')!;
    expect(formatRecurrence(r)).toBe('FREQ=WEEKLY;BYDAY=MO,WE');
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=MO,WE')).toBe('Cada semana (lun, mié)');
    expect(parseRecurrence('FREQ=YEARLY')).toBeNull();
  });
});

describe('dependencias', () => {
  // Aprender desarrollo web (prompt §7.3)
  const nodes = [
    { id: 'html', done: true, estimateMinutes: 600 },
    { id: 'css', done: false, estimateMinutes: 600 },
    { id: 'js', done: false, estimateMinutes: 1200 },
    { id: 'proyecto', done: false, estimateMinutes: 900 },
    { id: 'publicar', done: false, estimateMinutes: 60 },
    { id: 'logo', done: false, estimateMinutes: 120 },
  ];
  const edges = [
    { taskId: 'css', dependsOn: 'html' },
    { taskId: 'js', dependsOn: 'css' },
    { taskId: 'proyecto', dependsOn: 'js' },
    { taskId: 'proyecto', dependsOn: 'logo' },
    { taskId: 'publicar', dependsOn: 'proyecto' },
  ];
  const a = analyzeDag(nodes, edges);

  it('ordena, nivela y detecta bloqueos', () => {
    expect(a.order.indexOf('html')).toBeLessThan(a.order.indexOf('css'));
    expect(a.level.get('publicar')).toBe(4);
    expect([...a.ready].sort()).toEqual(['css', 'logo']);
    expect(a.blocked.has('js') && a.blocked.has('publicar')).toBe(true);
  });

  it('cuenta lo que desbloquea cada tarea y la ruta crítica', () => {
    expect(a.unlocks.get('css')).toBe(3);
    expect(a.unlocks.get('logo')).toBe(2);
    expect(a.criticalPath).toEqual(['css', 'js', 'proyecto', 'publicar']);
  });

  it('detecta ciclos antes de guardar', () => {
    expect(wouldCreateCycle(edges, 'html', 'publicar')).toBe(true);
    expect(wouldCreateCycle(edges, 'logo', 'html')).toBe(false);
    expect(() => analyzeDag(nodes, [...edges, { taskId: 'html', dependsOn: 'publicar' }])).toThrow(/ciclo/);
  });
});
