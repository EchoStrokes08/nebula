import { LIBRARY, type Category, type Intensity, type Message } from './library';

/**
 * Motor contextual (prompt §11.4): elige un mensaje según hechos reales. Si el contexto no
 * tiene un dato, los mensajes que lo necesitan no se usan (nunca se inventa información).
 */
export interface MotivationContext {
  intensity: Intensity;
  /** Momento de la app en el que se muestra. */
  moment: 'inicio' | 'enfoque' | 'cierre' | 'reto';
  hour: number;
  pendientes?: number;
  /** Tarea más aplazada (≥ 3). */
  tareaAplazada?: { titulo: string; aplazamientos: number };
  /** Hábito pendiente hoy. */
  habitoPendiente?: string;
  /** Hábito interrumpido (modo recuperación). */
  recuperacion?: { habito: string; dias: number; minimo: string };
  /** Meta próxima al plazo. */
  metaProxima?: { titulo: string; dias: number; restante: string };
  /** Reto que acaba pronto. */
  reto?: { dias: number; posicion: number; diferencia: string };
  objetivoEquipo?: { progreso: string };
  semana?: { constancia: string; completadas: number };
  racha?: number;
  /** Ids mostrados recientemente (se evitan). */
  recent?: string[];
}

const INTENSITY_ORDER: Intensity[] = ['balanced', 'demanding', 'intense'];

/** Intensidades permitidas: la elegida y las más suaves (nunca más dura que la elegida). */
export function allowedIntensities(i: Intensity): Intensity[] {
  return INTENSITY_ORDER.slice(0, INTENSITY_ORDER.indexOf(i) + 1);
}

function fill(text: string, vars: Record<string, string | number | undefined>): string | null {
  let missing = false;
  const out = text.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    if (v === undefined || v === '') {
      missing = true;
      return '';
    }
    return String(v);
  });
  return missing ? null : out;
}

/** Categorías candidatas por prioridad según el contexto (la primera con mensajes válidos gana). */
export function categoriesFor(ctx: MotivationContext): Category[] {
  const cats: Category[] = [];
  if (ctx.moment === 'enfoque') return ['enfoque', 'disciplina'];
  if (ctx.moment === 'reto' || (ctx.reto && ctx.reto.dias <= 2)) cats.push('competencia');
  if (ctx.recuperacion) cats.push('recuperacion');
  if (ctx.tareaAplazada && ctx.tareaAplazada.aplazamientos >= 3) cats.push('procrastinacion');
  if (ctx.metaProxima && ctx.metaProxima.dias <= 14) cats.push('metas');
  if (ctx.moment === 'cierre' || ctx.hour >= 21) cats.push('cierre');
  if (ctx.semana) cats.push('resultados');
  if (ctx.habitoPendiente) cats.push('habitos');
  if (ctx.objetivoEquipo) cats.push('colaboracion');
  if (ctx.racha && ctx.racha >= 3) cats.push('constancia');
  cats.push(ctx.hour < 12 ? 'inicio' : 'disciplina');
  return [...new Set(cats)];
}

export interface Chosen {
  id: string;
  text: string;
  category: Category;
}

/** Selección determinista por `seed` (p. ej. el día) para no cambiar el mensaje en cada render. */
export function chooseMessage(ctx: MotivationContext, seed = 0, library: Message[] = LIBRARY): Chosen | null {
  const vars = {
    pendientes: ctx.pendientes,
    tarea: ctx.tareaAplazada?.titulo,
    aplazamientos: ctx.tareaAplazada?.aplazamientos,
    habito: ctx.recuperacion?.habito ?? ctx.habitoPendiente,
    dias: ctx.recuperacion?.dias ?? ctx.metaProxima?.dias ?? ctx.reto?.dias,
    minimo: ctx.recuperacion?.minimo,
    meta: ctx.metaProxima?.titulo,
    restante: ctx.metaProxima?.restante,
    posicion: ctx.reto?.posicion,
    diferencia: ctx.reto?.diferencia,
    progreso: ctx.objetivoEquipo?.progreso,
    constancia: ctx.semana?.constancia,
    completadas: ctx.semana?.completadas,
    racha: ctx.racha,
  };
  const allowed = allowedIntensities(ctx.intensity);
  const recent = new Set(ctx.recent ?? []);
  for (const category of categoriesFor(ctx)) {
    const pool = library
      .filter((msg) => msg.category === category && allowed.includes(msg.intensity))
      .map((msg) => ({ msg, text: fill(msg.text, vars) }))
      .filter((x): x is { msg: Message; text: string } => x.text !== null);
    if (!pool.length) continue;
    // Prefiere los de la intensidad elegida y los no vistos recientemente.
    const fresh = pool.filter((x) => !recent.has(x.msg.id));
    const candidates = (fresh.length ? fresh : pool).sort((a, b) => (b.msg.intensity === ctx.intensity ? 1 : 0) - (a.msg.intensity === ctx.intensity ? 1 : 0));
    const top = candidates.filter((x) => x.msg.intensity === candidates[0]!.msg.intensity);
    const pick = top[Math.abs(seed) % top.length]!;
    return { id: pick.msg.id, text: pick.text, category };
  }
  return null;
}
