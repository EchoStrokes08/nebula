/**
 * `fetch` con límite de tiempo. Sin él, una red que no responde (DNS o cortafuegos que descartan
 * paquetes) deja las peticiones colgadas para siempre y la app no sale del splash.
 * Respeta la señal de cancelación del llamante.
 */
export function fetchWithTimeout(timeoutMs: number, base: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('La conexión tardó demasiado.')), timeoutMs);
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) controller.abort(outer.reason);
      else outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true });
    }
    return base(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}
