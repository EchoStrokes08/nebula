/** Fallo al llamar a la función `ai-assist`, tal como llega a la app. */
export interface AssistantFailure {
  /** Estado HTTP; ausente si la petición ni siquiera llegó al servidor. */
  status?: number;
  /** `code` del cuerpo de la respuesta (servidores 1.2.2+). */
  code?: string;
  /** Nombre del error de supabase-js (`FunctionsFetchError`, `FunctionsRelayError`, …). */
  name?: string;
}

const MESSAGES = {
  network: 'No se pudo conectar con el servidor de Nebula. Revisa tu conexión a internet y reintenta.',
  daily_limit: 'Has usado las 20 consultas de hoy al asistente. Mañana se renuevan; mientras tanto puedes usar la captura rápida.',
  models_busy: 'Los modelos de IA están saturados ahora mismo. No se ha gastado ninguna consulta; reintenta en un par de minutos.',
  models_error: 'Los modelos de IA han rechazado la consulta por un problema de configuración del servidor. No se ha gastado ninguna consulta; avisa al administrador.',
  not_configured: 'El asistente de IA no está configurado en el servidor. Mientras tanto puedes usar la captura rápida.',
  ai_disabled: 'El asistente de IA está desactivado para tu cuenta. Actívalo en Ajustes para usarlo.',
  unauthorized: 'Tu sesión ha caducado. Vuelve a iniciar sesión y reintenta.',
  invalid_request: 'El servidor no ha entendido la consulta. Actualiza la app y reintenta.',
  internal: 'El servidor del asistente ha tenido un error interno. Reintenta en un momento o usa la captura rápida.',
  unknown: 'El asistente no está disponible ahora mismo. Reintenta en un momento o usa la captura rápida.',
} as const;

export type AssistantErrorKind = keyof typeof MESSAGES;

/** Clasifica el fallo: primero por el `code` del servidor; si no lo hay (servidor antiguo), por estado. */
export function assistantErrorKind({ status, code, name }: AssistantFailure): AssistantErrorKind {
  if (code && code in MESSAGES && code !== 'network' && code !== 'unknown') return code as AssistantErrorKind;
  if (status === undefined) return name === 'FunctionsFetchError' || name === 'TypeError' || name === undefined ? 'network' : 'unknown';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'ai_disabled';
  if (status === 429) return 'daily_limit';
  if (status === 503) return 'models_busy';
  if (status >= 500) return 'internal';
  return 'unknown';
}

export const assistantErrorMessage = (failure: AssistantFailure) => MESSAGES[assistantErrorKind(failure)];

/** Extrae estado y `code` de un error de `functions.invoke` (el cuerpo solo se puede leer una vez). */
export async function readAssistantFailure(error: unknown): Promise<AssistantFailure> {
  const e = error as { name?: string; context?: { status?: number; json?: () => Promise<unknown> } };
  const response = e?.context;
  const status = typeof response?.status === 'number' ? response.status : undefined;
  let code: string | undefined;
  if (status !== undefined && typeof response?.json === 'function') {
    const data = await response.json().catch(() => null) as { code?: unknown } | null;
    if (typeof data?.code === 'string') code = data.code;
  }
  return { status, code, name: e?.name };
}

/** Esperas antes de cada reintento automático (como mucho, dos reintentos). */
export const RETRY_DELAYS_MS = [4000, 10000] as const;
/** Si un intento ya tardó esto, el servidor probó la cadena entera con calma: no se insiste. */
const SLOW_ATTEMPT_MS = 45000;

/**
 * Reintento automático ante fallos pasajeros (saturación o conexión) que fallaron rápido: en
 * unos segundos suelen liberarse los modelos. El servidor no cobra las consultas fallidas.
 * Devuelve la espera en ms, o null si no hay que reintentar.
 */
export function retryDelay(kind: AssistantErrorKind, elapsedMs: number, retriesDone: number): number | null {
  if (kind !== 'models_busy' && kind !== 'network') return null;
  if (elapsedMs >= SLOW_ATTEMPT_MS) return null;
  return RETRY_DELAYS_MS[retriesDone] ?? null;
}

/**
 * Llama al asistente reintentando solo los fallos pasajeros. `ask` hace una llamada y devuelve el
 * resultado de `functions.invoke`; `onRetry` recibe el aviso que mostrar mientras se espera ('' al
 * reintentar). Lanza un Error con el mensaje para la persona si al final no hay respuesta.
 */
export async function askWithRetry<T extends { error: unknown; data: unknown }>(
  ask: () => Promise<T>,
  onRetry: (notice: string) => void = () => undefined,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => number = Date.now,
): Promise<T> {
  for (let retries = 0; ; retries += 1) {
    const started = now();
    const r = await ask();
    if (!r.error) return r;
    const failure = await readAssistantFailure(r.error);
    const wait = retryDelay(assistantErrorKind(failure), now() - started, retries);
    if (wait === null) throw new Error(assistantErrorMessage(failure));
    onRetry(failure.status === undefined ? 'Se cortó la conexión; reintentando…' : 'Los modelos de IA están muy ocupados; reintentando en unos segundos…');
    await sleep(wait);
    onRetry('');
  }
}
