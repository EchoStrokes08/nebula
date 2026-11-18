import { evaluate, probeModel, rankModels, type HealthRow } from '../../../supabase/functions/ai-assist/health';
import { createProvider, resetModelHealth, type Attempt, type ModelSpec } from '../../../supabase/functions/ai-assist/provider';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const row = (model: string, extra: Partial<HealthRow> = {}): HealthRow => ({ model, available: true, success_rate: 1, latency_ms: 1000, checked_at: '2026-11-19T07:00:00Z', ...extra });
const spec = (provider: string, model = 'm'): ModelSpec => ({ id: `${provider}:${model}`, provider, base: 'https://api.example.com/v1', model, key: 'k', effort: undefined });

describe('ranking de modelos', () => {
  const ids = ['groq:a', 'openrouter:b', 'nvidia:c', 'cloudflare:d'];

  it('sin datos mantiene el orden de preferencia', () => {
    expect(rankModels(ids, [], NOW)).toEqual(ids);
  });

  it('pasa los caídos al final y los irregulares detrás de los sanos', () => {
    const rows = [row('groq:a', { available: false }), row('openrouter:b', { success_rate: 0.3 }), row('nvidia:c')];
    expect(rankModels(ids, rows, NOW)).toEqual(['nvidia:c', 'cloudflare:d', 'openrouter:b', 'groq:a']);
  });

  it('ignora evaluaciones de hace más de 13 horas', () => {
    const rows = [row('groq:a', { available: false, checked_at: '2026-11-18T20:00:00Z' })];
    expect(rankModels(ids, rows, NOW)[0]).toBe('groq:a');
  });
});

describe('evaluación', () => {
  it('con uso real suficiente decide por los resultados, sin sondear', () => {
    expect(evaluate({ ok_count: 1, busy_count: 4, error_count: 0, ms_total: 3000 })).toMatchObject({ available: false, success_rate: 0.2, source: 'uso' });
    expect(evaluate({ ok_count: 3, busy_count: 1, error_count: 0, ms_total: 6000 })).toMatchObject({ available: true, success_rate: 0.75, latency_ms: 2000, source: 'uso' });
  });

  it('con poco uso decide por el sondeo', () => {
    expect(evaluate({ ok_count: 1 }, { ok: false, ms: 20000, rate: 0, note: 'HTTP 429' })).toMatchObject({ available: false, source: 'sondeo', note: 'HTTP 429' });
  });
});

describe('sondeo barato', () => {
  it('OpenRouter se consulta por su estado público, sin gastar consultas', async () => {
    const send = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { endpoints: [{ status: 0, uptime_last_30m: 80 }, { status: 1, uptime_last_30m: 100 }] } }) });
    await expect(probeModel(spec('openrouter', 'x/y:free'), send)).resolves.toMatchObject({ ok: true, rate: 0.8 });
    expect(send).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models/x/y:free/endpoints', expect.anything());
  });

  it('los demás reciben un ping de pocos tokens', async () => {
    const send = jest.fn().mockResolvedValue({ ok: false, status: 429, body: null });
    await expect(probeModel(spec('groq'), send)).resolves.toMatchObject({ ok: false, note: 'HTTP 429' });
    expect(JSON.parse(send.mock.calls[0][1].body).max_tokens).toBeLessThanOrEqual(8);
  });
});

describe('cadena con salud', () => {
  beforeEach(() => resetModelHealth());
  const env = (k: string) => ({ AI_PROVIDER: 'groq', AI_MODEL: 'a', AI_API_KEY: 'k', AI_FALLBACK_PROVIDER: 'nvidia', AI_FALLBACK_MODEL: 'c', AI_FALLBACK_API_KEY: 'k2' } as Record<string, string>)[k];
  const ok = { ok: true, status: 200, headers: new Headers(), json: async () => ({ choices: [{ message: { content: JSON.stringify({ message: 'hola', actions: [] }) } }] }) };

  it('usa el orden de salud y registra cada intento', async () => {
    const attempts: Attempt[] = [];
    const send = jest.fn().mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers(), body: null }).mockResolvedValueOnce(ok);
    const p = createProvider(env, send, Date.now, { order: (ids) => [...ids].reverse(), onAttempt: (a) => attempts.push(a) })!;
    await expect(p.respond('x', {})).resolves.toMatchObject({ message: 'hola' });
    expect(attempts.map((a) => [a.model, a.outcome])).toEqual([['nvidia:c', 'busy'], ['groq:a', 'ok']]);
  });
});
