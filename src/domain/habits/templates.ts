import type { HabitKind } from './types';

/**
 * Hábitos sugeridos por categoría para crear uno en dos toques. Cada plantilla rellena el
 * formulario (tipo, objetivo, unidad, icono, color, hora) y el usuario solo ajusta lo que quiera.
 */
export type TemplateCategory = 'salud' | 'ejercicio' | 'mente' | 'aprender' | 'productividad' | 'dinero' | 'hogar' | 'social' | 'dejar';

export interface HabitTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  icon: string;
  color: 'violet' | 'lavender' | 'cyan' | 'green' | 'amber' | 'rose' | 'coral' | 'sky';
  kind: HabitKind;
  period: 'day' | 'week' | 'month';
  target: number;
  unit?: string;
  sessionMin?: number;
  minTarget?: number;
  /** Hora de recordatorio sugerida (HH:MM). */
  reminder?: string;
  /** Días (0 = domingo); vacío = todos. */
  days?: number[];
  /** Por qué ayuda, en una línea. */
  why: string;
}

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; emoji: string }[] = [
  { id: 'salud', label: 'Salud', emoji: '💧' },
  { id: 'ejercicio', label: 'Ejercicio', emoji: '🏃' },
  { id: 'mente', label: 'Mente', emoji: '🧘' },
  { id: 'aprender', label: 'Aprender', emoji: '📚' },
  { id: 'productividad', label: 'Productividad', emoji: '🎯' },
  { id: 'dinero', label: 'Dinero', emoji: '💰' },
  { id: 'hogar', label: 'Hogar', emoji: '🏠' },
  { id: 'social', label: 'Relaciones', emoji: '🤝' },
  { id: 'dejar', label: 'Dejar de…', emoji: '🚫' },
];

const t = (category: TemplateCategory, list: Omit<HabitTemplate, 'category' | 'id'>[]): HabitTemplate[] =>
  list.map((x, i) => ({ ...x, category, id: `${category}-${i + 1}` }));

const WEEKDAYS = [1, 2, 3, 4, 5];

export const HABIT_TEMPLATES: HabitTemplate[] = [
  ...t('salud', [
    { name: 'Beber agua', icon: 'droplet', color: 'cyan', kind: 'quantity', period: 'day', target: 8, unit: 'vasos', minTarget: 4, why: 'Hidratarte mejora la energía y la concentración.' },
    { name: 'Dormir 8 horas', icon: 'moon', color: 'lavender', kind: 'duration', period: 'day', target: 480, minTarget: 420, why: 'El sueño es la base de todo lo demás.' },
    { name: 'Comer fruta', icon: 'apple', color: 'green', kind: 'quantity', period: 'day', target: 2, unit: 'piezas', minTarget: 1, why: 'Un gesto pequeño que suma vitaminas y fibra.' },
    { name: 'Comer verdura', icon: 'salad', color: 'green', kind: 'binary', period: 'day', target: 1, why: 'Al menos un plato de verdura al día.' },
    { name: 'Tomar la medicación', icon: 'pill', color: 'coral', kind: 'binary', period: 'day', target: 1, reminder: '09:00', why: 'Con recordatorio para no olvidarla.' },
    { name: 'Ducha fría', icon: 'shower-head', color: 'sky', kind: 'binary', period: 'day', target: 1, why: 'Despierta el cuerpo y entrena la voluntad.' },
    { name: 'Acostarse temprano', icon: 'bed', color: 'lavender', kind: 'binary', period: 'day', target: 1, reminder: '22:30', why: 'Proteger la noche protege la mañana siguiente.' },
  ]),
  ...t('ejercicio', [
    { name: 'Correr', icon: 'footprints', color: 'amber', kind: 'frequency', period: 'week', target: 3, why: 'Tres salidas a la semana bastan para notar el cambio.' },
    { name: 'Hacer ejercicio', icon: 'dumbbell', color: 'coral', kind: 'duration', period: 'day', target: 30, minTarget: 10, days: WEEKDAYS, why: '30 minutos al día, entre semana.' },
    { name: 'Caminar 10.000 pasos', icon: 'footprints', color: 'green', kind: 'quantity', period: 'day', target: 10000, unit: 'pasos', minTarget: 5000, why: 'Moverse sin necesidad de gimnasio.' },
    { name: 'Estirar', icon: 'heart-pulse', color: 'rose', kind: 'duration', period: 'day', target: 10, minTarget: 3, why: 'Menos rigidez y mejor postura.' },
    { name: 'Ir en bici', icon: 'bike', color: 'cyan', kind: 'cumulative', period: 'week', target: 50, unit: 'km', why: 'Suma kilómetros a tu ritmo durante la semana.' },
    { name: 'Entrenar fuerza', icon: 'dumbbell', color: 'amber', kind: 'flexible', period: 'week', target: 3, sessionMin: 30, why: 'Tres sesiones semanales de al menos 30 min, el día que puedas.' },
  ]),
  ...t('mente', [
    { name: 'Meditar', icon: 'sprout', color: 'green', kind: 'duration', period: 'day', target: 10, minTarget: 2, reminder: '08:00', why: 'Diez minutos de calma antes de empezar.' },
    { name: 'Escribir un diario', icon: 'notebook-pen', color: 'lavender', kind: 'binary', period: 'day', target: 1, reminder: '22:00', why: 'Ordenar la cabeza antes de dormir.' },
    { name: 'Agradecer 3 cosas', icon: 'hand-heart', color: 'rose', kind: 'binary', period: 'day', target: 1, why: 'Entrena la atención hacia lo que sí va bien.' },
    { name: 'Respirar profundo', icon: 'wind', color: 'sky', kind: 'frequency', period: 'day', target: 3, why: 'Tres pausas de respiración al día.' },
    { name: 'Salir a la naturaleza', icon: 'leaf', color: 'green', kind: 'frequency', period: 'week', target: 2, why: 'Desconectar al aire libre dos veces por semana.' },
  ]),
  ...t('aprender', [
    { name: 'Leer', icon: 'book-open', color: 'amber', kind: 'quantity', period: 'day', target: 10, unit: 'páginas', minTarget: 2, why: 'Diez páginas al día son más de diez libros al año.' },
    { name: 'Practicar un idioma', icon: 'languages', color: 'sky', kind: 'duration', period: 'day', target: 15, minTarget: 5, why: 'Un poco cada día gana a mucho de vez en cuando.' },
    { name: 'Programar', icon: 'code', color: 'violet', kind: 'duration', period: 'day', target: 60, minTarget: 15, days: WEEKDAYS, why: 'Una hora de práctica deliberada entre semana.' },
    { name: 'Estudiar', icon: 'brain', color: 'violet', kind: 'flexible', period: 'week', target: 5, sessionMin: 45, why: 'Cinco sesiones semanales de estudio de al menos 45 min.' },
    { name: 'Tocar un instrumento', icon: 'music', color: 'rose', kind: 'duration', period: 'day', target: 20, minTarget: 5, why: 'La constancia hace la técnica.' },
    { name: 'Dibujar o crear', icon: 'palette', color: 'coral', kind: 'frequency', period: 'week', target: 3, why: 'Un rato creativo tres veces por semana.' },
  ]),
  ...t('productividad', [
    { name: 'Planificar el día', icon: 'list-checks', color: 'violet', kind: 'binary', period: 'day', target: 1, reminder: '08:30', days: WEEKDAYS, why: 'Cinco minutos de plan ahorran horas de dispersión.' },
    { name: 'Madrugar', icon: 'sunrise', color: 'amber', kind: 'binary', period: 'day', target: 1, days: WEEKDAYS, why: 'Empezar antes que el ruido del día.' },
    { name: 'Bloque de trabajo profundo', icon: 'brain', color: 'cyan', kind: 'duration', period: 'day', target: 90, minTarget: 25, days: WEEKDAYS, why: 'Tu mejor trabajo necesita tiempo sin interrupciones.' },
    { name: 'Bandeja de entrada a cero', icon: 'list-checks', color: 'sky', kind: 'binary', period: 'day', target: 1, days: WEEKDAYS, why: 'Cerrar el día sin pendientes flotando.' },
    { name: 'Revisión semanal', icon: 'notebook-pen', color: 'lavender', kind: 'frequency', period: 'week', target: 1, why: 'Mirar atrás y elegir prioridades para la semana.' },
  ]),
  ...t('dinero', [
    { name: 'Apuntar los gastos', icon: 'wallet', color: 'green', kind: 'binary', period: 'day', target: 1, reminder: '21:30', why: 'Lo que se mide se puede mejorar.' },
    { name: 'Ahorrar', icon: 'piggy-bank', color: 'amber', kind: 'cumulative', period: 'month', target: 100, unit: '€', why: 'Una meta mensual de ahorro, poco a poco.' },
    { name: 'Día sin gastos', icon: 'wallet', color: 'cyan', kind: 'frequency', period: 'week', target: 2, why: 'Dos días a la semana sin gastar nada.' },
  ]),
  ...t('hogar', [
    { name: 'Hacer la cama', icon: 'bed', color: 'lavender', kind: 'binary', period: 'day', target: 1, why: 'La primera victoria del día.' },
    { name: 'Ordenar 10 minutos', icon: 'house', color: 'sky', kind: 'duration', period: 'day', target: 10, minTarget: 5, why: 'Diez minutos diarios mantienen la casa a raya.' },
    { name: 'Limpiar', icon: 'brush', color: 'cyan', kind: 'frequency', period: 'week', target: 2, why: 'Dos limpiezas a la semana, sin maratones.' },
    { name: 'Regar las plantas', icon: 'flower-2', color: 'green', kind: 'frequency', period: 'week', target: 2, why: 'Que no se te olviden.' },
    { name: 'Cocinar en casa', icon: 'salad', color: 'amber', kind: 'frequency', period: 'week', target: 4, why: 'Comer mejor y gastar menos.' },
  ]),
  ...t('social', [
    { name: 'Llamar a la familia', icon: 'users', color: 'rose', kind: 'frequency', period: 'week', target: 1, why: 'Una llamada a la semana a quien te importa.' },
    { name: 'Escribir a un amigo', icon: 'smile', color: 'amber', kind: 'frequency', period: 'week', target: 2, why: 'Cuidar las amistades también es un hábito.' },
    { name: 'Un acto amable', icon: 'hand-heart', color: 'coral', kind: 'binary', period: 'day', target: 1, why: 'Un detalle con alguien cada día.' },
    { name: 'Comer sin pantallas', icon: 'phone-off', color: 'violet', kind: 'binary', period: 'day', target: 1, why: 'Estar presente con quien comes.' },
  ]),
  ...t('dejar', [
    { name: 'Menos redes sociales', icon: 'smartphone', color: 'coral', kind: 'reduction', period: 'day', target: 30, unit: 'min', why: 'Un límite diario de tiempo en redes.' },
    { name: 'Menos café', icon: 'coffee', color: 'amber', kind: 'reduction', period: 'day', target: 2, unit: 'cafés', why: 'Máximo dos al día.' },
    { name: 'Dejar de fumar', icon: 'cigarette-off', color: 'green', kind: 'reduction', period: 'day', target: 0, unit: 'cigarrillos', why: 'Cada día a cero cuenta. Y si no, reduce.' },
    { name: 'Menos alcohol', icon: 'wine', color: 'rose', kind: 'reduction', period: 'week', target: 2, unit: 'copas', why: 'Un límite semanal claro.' },
    { name: 'Menos azúcar', icon: 'cup-soda', color: 'sky', kind: 'reduction', period: 'day', target: 1, unit: 'dulces', why: 'Reducir sin prohibir.' },
    { name: 'Móvil fuera de la cama', icon: 'phone-off', color: 'lavender', kind: 'binary', period: 'day', target: 1, reminder: '23:00', why: 'Dormir mejor empieza por dejar el móvil lejos.' },
  ]),
];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Búsqueda sin tildes por nombre, motivo o categoría. */
export function searchTemplates(query: string, category?: TemplateCategory | null): HabitTemplate[] {
  const q = fold(query.trim());
  return HABIT_TEMPLATES.filter((x) => (!category || x.category === category) && (!q || fold(`${x.name} ${x.why} ${TEMPLATE_CATEGORIES.find((c) => c.id === x.category)!.label}`).includes(q)));
}

/** Resumen corto del objetivo, p. ej. «8 vasos al día» o «3 veces por semana». */
export function describeTemplate(x: Pick<HabitTemplate, 'kind' | 'period' | 'target' | 'unit' | 'sessionMin'>): string {
  const per = { day: 'al día', week: 'por semana', month: 'al mes' }[x.period];
  switch (x.kind) {
    case 'binary': return 'Cada día';
    case 'duration': return x.target >= 60 && x.target % 60 === 0 ? `${x.target / 60} h ${per}` : `${x.target} min ${per}`;
    case 'frequency': return `${x.target} ${x.target === 1 ? 'vez' : 'veces'} ${per}`;
    case 'flexible': return `${x.target} sesiones de ${x.sessionMin} min ${per}`;
    case 'reduction': return `Máximo ${x.target} ${x.unit ?? ''} ${per}`.replace(/\s+/g, ' ');
    default: return `${x.target.toLocaleString('es')} ${x.unit ?? ''} ${per}`.replace(/\s+/g, ' ');
  }
}
