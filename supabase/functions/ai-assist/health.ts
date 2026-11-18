import type { ModelSpec } from './provider.ts';

/**
 * Salud de los modelos de IA. Cada 6 horas `ai-health` evalúa cada modelo y guarda el resultado en
 * `ai_model_health`; `ai-assist` lo usa para ordenar la cadena.
 *  - Aprende sobre todo del uso real (cada intento suma ok/saturado/error sin gastar nada extra).
 *  - Solo sondea los modelos sin uso suficiente en la ventana, con un «ping» de pocos tokens.
 *  - OpenRouter no se sondea con consultas (50 al día gratis): su API publica gratis el estado.
 */

/** Fila de `ai_model_health` (contadores de la ventana actual + última evaluación). */
export interface HealthRow {
  model: string;
  available: boolean | null;
  success_rate: number | null;
  latency_ms: number | null;
  checked_at: string | null;
  ok_count?: number;
  busy_count?: number;
  error_count?: number;
  ms_total?: number;
}

export interface ProbeResult { ok: boolean; ms: number; rate: number; note: string }
export interface Evaluation { available: boolean; success_rate: number; latency_ms: number | null; source: 'uso' | 'sondeo'; note: string }

/** Con al menos este número de intentos reales en la ventana no hace falta sondear. */
export const MIN_TRAFFIC = 3;
/** Una evaluación más vieja que esto ya no se tiene en cuenta (el cron corre cada 6 h). */
export const STALE_MS = 13 * 60 * 60 * 1000;
const PROBE_TIMEOUT_MS = 20000;

export const trafficOf = (r?: Partial<HealthRow>) => (r?.ok_count ?? 0) + (r?.busy_count ?? 0) + (r?.error_count ?? 0);

/** Comprueba un modelo gastando lo mínimo. */
export async function probeModel(spec: ModelSpec, send: typeof fetch = fetch, now: () => number = Date.now): Promise<ProbeResult> {
  const start = now();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), PROBE_TIMEOUT_MS);
  try {
    if (spec.provider === 'openrouter') {
      // Estado público del modelo: no consume ninguna de las consultas gratuitas.
      const r = await send(`https://openrouter.ai/api/v1/models/${spec.model}/endpoints`, { signal: abort.signal });
      if (!r.ok) return { ok: false, ms: now() - start, rate: 0, note: `estado HTTP ${r.status}` };
      const data = await r.json() as { data?: { endpoints?: { status?: number; uptime_last_30m?: number | null }[] } };
      const up = (data.data?.endpoints ?? []).filter((e) => e.status === 0);
      if (!up.length) return { ok: false, ms: now() - start, rate: 0, note: 'sin proveedores activos' };
      const rate = Math.max(...up.map((e) => (typeof e.uptime_last_30m === 'number' ? e.uptime_last_30m / 100 : 1)));
      return { ok: rate >= 0.5, ms: now() - start, rate, note: `disponible ${Math.round(rate * 100)} % (30 min)` };
    }
    // Ping de pocos tokens: basta con que acepte la petición.
    const r = await send(`${spec.base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST', signal: abort.signal,
      headers: { Authorization: `Bearer ${spec.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: spec.model, messages: [{ role: 'user', content: 'Responde solo: ok' }], max_tokens: 8 }),
    });
    await r.body?.cancel?.().catch(() => undefined);
    return { ok: r.ok, ms: now() - start, rate: r.ok ? 1 : 0, note: r.ok ? 'responde' : `HTTP ${r.status}` };
  } catch {
    return { ok: false, ms: now() - start, rate: 0, note: 'no respondió en 20 s' };
  } finally {
    clearTimeout(timer);
  }
}

/** Evalúa un modelo: con uso real suficiente, por sus resultados; si no, por el sondeo. */
export function evaluate(row: Partial<HealthRow> | undefined, probe?: ProbeResult): Evaluation {
  const total = trafficOf(row);
  if (total >= MIN_TRAFFIC || !probe) {
    const ok = row?.ok_count ?? 0;
    const rate = total ? ok / total : 0;
    return {
      available: ok > 0 && rate >= 0.25, success_rate: rate,
      latency_ms: ok ? Math.round((row?.ms_total ?? 0) / ok) : null, source: 'uso',
      note: `${ok}/${total} consultas bien, ${row?.busy_count ?? 0} saturadas`,
    };
  }
  return { available: probe.ok, success_rate: probe.rate, latency_ms: probe.ok ? probe.ms : null, source: 'sondeo', note: probe.note };
}

/**
 * Ordena la cadena: primero los modelos sanos (o sin datos recientes) en su orden de preferencia,
 * después los irregulares (menos de la mitad de aciertos) y al final los caídos. Así se escoge el
 * más inteligente que está disponible, sin insistir con los saturados.
 */
export function rankModels(ids: string[], rows: HealthRow[], now: number): string[] {
  const byId = new Map(rows.map((r) => [r.model, r]));
  const tier = (id: string) => {
    const r = byId.get(id);
    if (!r?.checked_at || now - Date.parse(r.checked_at) > STALE_MS || r.available === null) return 0;
    if (!r.available) return 2;
    return (r.success_rate ?? 1) < 0.5 ? 1 : 0;
  };
  return ids.map((id, i) => ({ id, i, t: tier(id) })).sort((a, b) => a.t - b.t || a.i - b.i).map((x) => x.id);
}
