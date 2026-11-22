/**
 * `fetch` con límite de tiempo. Sin él, una red que no responde (DNS o cortafuegos que descartan
 * paquetes) deja las peticiones colgadas para siempre y la app no sale del splash.
 * Respeta la señal de cancelación del llamante.
 */
/** Límite para el asistente de IA: algo más que el plazo total del servidor (140 s). */
export const AI_TIMEOUT_MS = 150_000;

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

/** `timeoutMs` puede depender de la URL (p. ej. más margen para el asistente de IA). */
export function fetchWithTimeout(timeoutMs: number | ((url: string) => number), base: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const ms = typeof timeoutMs === 'function' ? timeoutMs(urlOf(input)) : timeoutMs;
    const timer = setTimeout(() => controller.abort(new Error('La conexión tardó demasiado.')), ms);
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) controller.abort(outer.reason);
      else outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true });
    }
    return base(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}
