import type { DayKey } from '@/lib/dates';

/**
 * Diario inteligente (F11-003): patrones deterministas, calculados en el dispositivo y solo con
 * consentimiento. Lenguaje de estimación; nunca diagnósticos.
 */
export interface JournalLike { day_key: DayKey; achievements: string; difficulties: string; learnings: string; next_step: string }
export interface JournalPattern { id: string; text: string }

export const MIN_ENTRIES = 6;
const STOP = new Set(('a al algo algunas algunos ante antes como con contra cual cuando de del desde donde durante e el ella ellas ellos en entre era es esa ese eso esta este esto estos fue fui ha hay hace hacer haber he hoy la las le les lo los mas más me mi mis mucho muy nada ni no nos o otra otro para pero poco por porque que qué se sea ser si sí sin sobre solo su sus también tan tanto te tener tengo todo tras tu un una uno unos y ya yo día dias días semana algo cosas cosa bien mal').split(' '));

export function terms(text: string): string[] {
  return [...new Set(text.toLowerCase().normalize('NFC').split(/[^a-záéíóúüñ]+/i).filter((w) => w.length >= 4 && !STOP.has(w)))];
}

export function journalPatterns(entries: JournalLike[], activeDays: Set<DayKey>, rangeDays: DayKey[]):
  { status: 'insufficient'; needed: number; have: number } | { status: 'ok'; patterns: JournalPattern[] } {
  const withText = entries.filter((e) => (e.achievements + e.difficulties + e.learnings + e.next_step).trim());
  if (withText.length < MIN_ENTRIES) return { status: 'insufficient', needed: MIN_ENTRIES, have: withText.length };
  const patterns: JournalPattern[] = [];

  const recurring = (field: 'difficulties' | 'achievements', label: string) => {
    const counts = new Map<string, number>();
    const relevant = withText.filter((e) => e[field].trim());
    for (const e of relevant) for (const t of terms(e[field])) counts.set(t, (counts.get(t) ?? 0) + 1);
    const top = [...counts.entries()].filter(([, n]) => n >= 3 && n / relevant.length >= 0.3).sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (const [t, n] of top) patterns.push({ id: `${field}-${t}`, text: `«${t}» aparece en ${n} de tus ${relevant.length} ${label}.` });
  };
  recurring('difficulties', 'reflexiones sobre lo que te dificultó avanzar');
  recurring('achievements', 'reflexiones sobre logros');

  // Días con reflexión frente al resto: asociación observada, no causa.
  const written = new Set(withText.map((e) => e.day_key));
  const inRange = rangeDays.filter((d) => written.has(d));
  const others = rangeDays.filter((d) => !written.has(d));
  if (inRange.length >= MIN_ENTRIES && others.length >= MIN_ENTRIES) {
    const pct = (ds: DayKey[]) => Math.round((ds.filter((d) => activeDays.has(d)).length / ds.length) * 100);
    const a = pct(inRange), b = pct(others);
    if (Math.abs(a - b) >= 15) patterns.push({ id: 'writing-days', text: `Los días en que escribiste registraste hábitos el ${a} % de las veces, frente al ${b} % del resto. Es una coincidencia observada, no necesariamente la causa.` });
  }

  const steps = withText.filter((e) => e.next_step.trim()).length;
  if (steps / withText.length < 0.3) patterns.push({ id: 'next-steps', text: `Solo ${steps} de ${withText.length} reflexiones terminan con un próximo paso concreto. Definirlo ayuda a retomar.` });
  return { status: 'ok', patterns };
}
