import type { HabitKind, HabitPeriod, PeriodResult } from '@/domain/habits/types';

const PERIOD: Record<HabitPeriod, string> = { day: 'hoy', week: 'esta semana', month: 'este mes' };

export const KIND_LABEL: Record<HabitKind, { title: string; help: string }> = {
  binary: { title: 'Sí / no', help: 'Lo haces o no lo haces. Ej.: tender la cama.' },
  duration: { title: 'Duración', help: 'Minutos por periodo. Ej.: 30 min de inglés al día.' },
  quantity: { title: 'Cantidad', help: 'Unidades por periodo. Ej.: 8 vasos de agua.' },
  frequency: { title: 'Frecuencia', help: 'Veces por periodo. Ej.: meditar 5 veces por semana.' },
  cumulative: { title: 'Acumulativo', help: 'Total en la semana o el mes. Ej.: 100 km al mes.' },
  reduction: { title: 'Reducción', help: 'No superar un límite. Ej.: máximo 2 cafés al día.' },
  flexible: { title: 'Flexible', help: 'N sesiones por semana de al menos X, el día que quieras.' },
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

export function unitLabel(kind: HabitKind, unit: string | null | undefined): string {
  if (kind === 'duration') return 'min';
  if (kind === 'frequency') return 'veces';
  if (kind === 'flexible') return 'sesiones';
  return unit ?? '';
}

/** Texto corto del progreso del periodo: «20 / 30 min hoy», «Hecho», «1 de 2 cafés hoy». */
export function progressText(kind: HabitKind, unit: string | null | undefined, r: PeriodResult, period: HabitPeriod): string {
  if (kind === 'binary') return r.status === 'met' ? 'Hecho hoy' : 'Pendiente hoy';
  const u = unitLabel(kind, unit);
  if (kind === 'reduction') {
    if (r.status === 'pending' && r.value === 0 && r.progress === 0) return `Límite ${fmt(r.target)} ${u} ${PERIOD[period]} · sin registrar`;
    return `${fmt(r.value)} de ${fmt(r.target)} ${u} ${PERIOD[period]}`;
  }
  return `${fmt(r.value)} / ${fmt(r.target)} ${u} ${PERIOD[period]}`.replace(/\s+/g, ' ');
}

export const percent = (ratio: number | null) => (ratio === null ? '—' : `${Math.round(ratio * 100)} %`);
export { fmt as formatNumber };

export const COLOR_NAMES: Record<string, string> = {
  violet: 'Violeta',
  lavender: 'Lavanda',
  cyan: 'Cian',
  green: 'Verde',
  amber: 'Ámbar',
  rose: 'Rosa',
  coral: 'Coral',
  sky: 'Celeste',
};
