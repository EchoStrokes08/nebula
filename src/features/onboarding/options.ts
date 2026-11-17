export const INTERESTS = [
  'Estudio', 'Trabajo', 'Salud', 'Ejercicio', 'Lectura', 'Idiomas',
  'Programación', 'Finanzas', 'Creatividad', 'Descanso',
] as const;

export const INTENSITIES = [
  {
    value: 'balanced',
    label: 'Equilibrado',
    description: 'Directo y constructivo.',
    sample: 'No necesitas un día perfecto. Necesitas empezar la primera tarea.',
  },
  {
    value: 'demanding',
    label: 'Exigente',
    description: 'Más firmeza y responsabilidad.',
    sample: 'Sabes lo que tienes que hacer. Seguir aplazándolo también es una decisión.',
  },
  {
    value: 'intense',
    label: 'Intenso',
    description: 'Confrontativo. Solo si lo eliges.',
    sample: 'Otro día esperando motivación es otro día sin avanzar. Empieza ahora.',
  },
] as const;
export type Intensity = (typeof INTENSITIES)[number]['value'];

/** 0 = domingo … 6 = sábado; se muestran empezando en lunes. */
export const WEEKDAYS = [
  { value: 1, label: 'L', name: 'Lunes' },
  { value: 2, label: 'M', name: 'Martes' },
  { value: 3, label: 'X', name: 'Miércoles' },
  { value: 4, label: 'J', name: 'Jueves' },
  { value: 5, label: 'V', name: 'Viernes' },
  { value: 6, label: 'S', name: 'Sábado' },
  { value: 0, label: 'D', name: 'Domingo' },
] as const;

export const FOCUS_WINDOWS = [
  { value: 'morning', label: 'Mañana', start: '07:00', end: '12:00' },
  { value: 'afternoon', label: 'Tarde', start: '12:00', end: '18:00' },
  { value: 'evening', label: 'Noche', start: '18:00', end: '23:00' },
] as const;

export const VISIBILITY = [
  { value: 'private', label: 'Privado', description: 'Nadie ve tu actividad.' },
  { value: 'friends', label: 'Amigos', description: 'Solo tus amigos ven lo que compartas.' },
  { value: 'public', label: 'Público', description: 'Cualquiera con tu @usuario ve tu perfil público.' },
] as const;
export type Visibility = (typeof VISIBILITY)[number]['value'];

export interface OnboardingAnswers {
  interests: string[];
  goals: string[];
  intensity: Intensity;
  activeDays: number[];
  focus: (typeof FOCUS_WINDOWS)[number]['value'][];
  visibility: Visibility;
}

export const defaultAnswers: OnboardingAnswers = {
  interests: [],
  goals: ['', '', ''],
  intensity: 'balanced',
  activeDays: [1, 2, 3, 4, 5],
  focus: [],
  visibility: 'friends',
};

/** Convierte las respuestas en las columnas de la base de datos. */
export function toPreferencesRow(a: OnboardingAnswers) {
  return {
    interests: a.interests,
    onboarding_goals: a.goals.map((g) => g.trim()).filter(Boolean).slice(0, 10),
    motivation_intensity: a.intensity,
    active_days: [...a.activeDays].sort(),
    focus_windows: FOCUS_WINDOWS.filter((w) => a.focus.includes(w.value)).map(({ start, end }) => ({ start, end })),
  };
}

/** @usuario provisional generado en el alta (p. ej. al entrar con Google). */
export const isProvisionalHandle = (h: string | undefined) => !!h && /^usuario_[a-f0-9]{8}$/.test(h);
