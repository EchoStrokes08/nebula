import { createProvider, planShortfall, ProviderUnavailable, resetModelHealth } from '../../../supabase/functions/ai-assist/provider';
import { samplePlan } from './plan.fixture';

const ok = (message: string) => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ choices: [{ message: { content: JSON.stringify({ message, actions: [] }) } }] }) });
const fail = (status: number, retry?: string) => ({ ok: false, status, headers: new Headers(retry ? { 'retry-after': retry } : {}), body: null });
const model = (call: unknown[]) => JSON.parse((call[1] as { body: string }).body).model as string;

// Groq como principal (sin streaming) para simular respuestas completas.
const env = (extra: Record<string, string> = {}) => (k: string) => ({
  AI_PROVIDER: 'groq', AI_MODEL: 'listo', AI_API_KEY: 'a', AI_ALTERNATE_MODELS: 'medio, listo',
  AI_FALLBACK_PROVIDER: 'groq', AI_FALLBACK_MODEL: 'rapido', AI_FALLBACK_API_KEY: 'b', ...extra,
} as Record<string, string>)[k];

beforeEach(() => resetModelHealth());

describe('respaldo inteligente de modelos', () => {
  it('usa el más inteligente disponible y baja de nivel solo si falla', async () => {
    const send = jest.fn().mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok('del medio'));
    await expect(createProvider(env(), send)!.respond('hola', {})).resolves.toMatchObject({ message: 'del medio' });
    expect(send.mock.calls.map(model)).toEqual(['listo', 'medio']); // sin duplicar «listo»
  });

  it('salta al instante un modelo saturado mientras descansa y vuelve a él cuando se recupera', async () => {
    let t = 0;
    const send = jest.fn(async (_u: string, init: { body: string }) => (JSON.parse(init.body).model === 'listo' && t < 30_000 ? fail(429, '30') : ok(JSON.parse(init.body).model)));
    const p = createProvider(env(), send as unknown as typeof fetch, () => t)!;
    await expect(p.respond('1', {})).resolves.toMatchObject({ message: 'medio' });
    send.mockClear();
    t = 10_000;
    await expect(p.respond('2', {})).resolves.toMatchObject({ message: 'medio' });
    expect(send.mock.calls.map(model)).toEqual(['medio']); // «listo» descansa: ni se intenta
    t = 31_000;
    await expect(p.respond('3', {})).resolves.toMatchObject({ message: 'listo' });
  });

  it('una salida inválida pasa al siguiente sin castigar al modelo', async () => {
    const bad = { ok: true, status: 200, headers: new Headers(), json: async () => ({ choices: [{ message: { content: 'no es json' } }] }) };
    const send = jest.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(ok('medio')).mockResolvedValueOnce(ok('listo'));
    const p = createProvider(env(), send)!;
    await expect(p.respond('1', {})).resolves.toMatchObject({ message: 'medio' });
    await expect(p.respond('2', {})).resolves.toMatchObject({ message: 'listo' });
  });

  it('no empieza intentos sin tiempo suficiente y falla con un error genérico', async () => {
    let t = 0;
    const send = jest.fn(async () => { t += 130_000; return fail(503); });
    await expect(createProvider(env(), send as unknown as typeof fetch, () => t)!.respond('x', {})).rejects.toThrow('provider unavailable');
    expect(send).toHaveBeenCalledTimes(1); // tras 130 s quedan 10 s < 15 s mínimos
  });

  it('si todos descansan, prueba primero el que antes se recupera', async () => {
    let t = 0;
    const send = jest.fn(async (_u: string, init: { body: string }) => {
      const m = JSON.parse(init.body).model;
      return t === 0 ? fail(429, m === 'rapido' ? '5' : '300') : ok(m);
    });
    const p = createProvider(env(), send as unknown as typeof fetch, () => t)!;
    await expect(p.respond('1', {})).rejects.toThrow();
    send.mockClear(); t = 1000;
    await expect(p.respond('2', {})).resolves.toMatchObject({ message: 'rapido' });
    expect(send.mock.calls.map(model)[0]).toBe('rapido');
  });
});

describe('streaming con Google', () => {
  const googleEnv = (k: string) => ({ AI_PROVIDER: 'google', AI_MODEL: 'hydrogen', AI_API_KEY: 'g', AI_CONNECT_TIMEOUT_MS: '50', AI_FALLBACK_PROVIDER: 'groq', AI_FALLBACK_MODEL: 'rapido', AI_FALLBACK_API_KEY: 'q' } as Record<string, string>)[k];
  const sse = (text: string) => {
    const half = Math.floor(text.length / 2);
    const chunks = [text.slice(0, half), text.slice(half)].map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`);
    return new ReadableStream<Uint8Array>({ start(ctrl) { for (const c of [...chunks, 'data: [DONE]\n\n']) ctrl.enqueue(new TextEncoder().encode(c)); ctrl.close(); } });
  };

  it('junta los trozos del flujo y pide stream solo a Google', async () => {
    const send = jest.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), body: sse(JSON.stringify({ message: 'por trozos', actions: [] })) });
    await expect(createProvider(googleEnv, send)!.respond('hola', {})).resolves.toMatchObject({ message: 'por trozos' });
    expect(JSON.parse(send.mock.calls[0]![1].body).stream).toBe(true);
  });

  it('abandona un modelo en cola que no empieza a responder y usa el siguiente', async () => {
    const send = jest.fn((_u: string, init: { body: string; signal: AbortSignal }) => {
      if (JSON.parse(init.body).model === 'hydrogen') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('abort'))));
      return Promise.resolve(ok('rapido'));
    });
    const started = Date.now();
    await expect(createProvider(googleEnv, send as unknown as typeof fetch)!.respond('hola', {})).resolves.toMatchObject({ message: 'rapido' });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(JSON.parse(send.mock.calls[1]![1].body).stream).toBeUndefined();
  });
});

describe('motivo cuando fallan todos los modelos', () => {
  const reason = async (statuses: number[]) => {
    const send = jest.fn();
    for (const s of statuses) send.mockResolvedValueOnce(fail(s));
    return createProvider(env(), send)!.respond('x', {}).then(() => null, (e: unknown) => e);
  };

  it('saturación si alguno estaba saturado o con límite', async () => {
    const e = await reason([503, 401, 429]);
    expect(e).toBeInstanceOf(ProviderUnavailable);
    expect((e as ProviderUnavailable).busy).toBe(true);
  });

  it('configuración rota si todos rechazan la petición (clave o modelo inválidos)', async () => {
    const e = await reason([401, 404, 400]);
    expect(e).toBeInstanceOf(ProviderUnavailable);
    expect((e as ProviderUnavailable).busy).toBe(false);
  });
});

describe('tres proveedores', () => {
  it('baja de Groq a OpenRouter y después a Cloudflare, cada uno con su clave y URL', async () => {
    const env3 = (k: string) => ({
      AI_PROVIDER: 'groq', AI_MODEL: 'g', AI_API_KEY: 'kg',
      AI_FALLBACK_PROVIDER: 'openrouter', AI_FALLBACK_MODEL: 'o', AI_FALLBACK_API_KEY: 'ko',
      AI_FALLBACK2_PROVIDER: 'cloudflare', AI_FALLBACK2_MODEL: 'c', AI_FALLBACK2_API_KEY: 'kc',
      AI_FALLBACK2_BASE_URL: 'https://api.cloudflare.com/client/v4/accounts/x/ai/v1',
    } as Record<string, string>)[k];
    const send = jest.fn().mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(fail(429)).mockResolvedValueOnce(ok('de cloudflare'));
    await expect(createProvider(env3, send)!.respond('x', {})).resolves.toMatchObject({ message: 'de cloudflare' });
    expect(send.mock.calls.map((c) => [c[0], (c[1] as { headers: Record<string, string> }).headers.Authorization])).toEqual([
      ['https://api.groq.com/openai/v1/chat/completions', 'Bearer kg'],
      ['https://openrouter.ai/api/v1/chat/completions', 'Bearer ko'],
      ['https://api.cloudflare.com/client/v4/accounts/x/ai/v1/chat/completions', 'Bearer kc'],
    ]);
  });
});

describe('planes incompletos', () => {
  const task = (i: number) => ({ ...samplePlan.tasks[0], title: `Tarea ${i}`, steps: ['a', 'b'], done: 'hecho' });
  const plan = (tasks: number, habits: number) => ({ ...samplePlan, milestones: [0, 1, 2, 3].map((i) => ({ title: `Hito ${i}`, day: null })), tasks: Array.from({ length: tasks }, (_, i) => task(i)), habits: samplePlan.habits.concat(samplePlan.habits, samplePlan.habits).slice(0, habits) });
  const reply = (tasks: number, habits: number) => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ choices: [{ message: { content: JSON.stringify({ message: `${tasks}/${habits}`, actions: [plan(tasks, habits)] }) } }] }) });

  it('detecta planes cortos, sin hábitos o con tareas sin pasos', () => {
    expect(planShortfall({ actions: [plan(12, 2)] })).toBeNull();
    expect(planShortfall({ actions: [plan(3, 1)] })).toMatch(/3 tareas/);
    expect(planShortfall({ actions: [plan(12, 0)] })).toMatch(/sin hábitos/);
    expect(planShortfall({ actions: [{ ...plan(10, 1), tasks: plan(10, 1).tasks.map((t) => ({ ...t, steps: [] })) }] })).toMatch(/sin pasos/);
    expect(planShortfall({ message: 'hola', actions: [] })).toBeNull(); // sin plan no se exige nada
  });

  it('pide el plan a otro modelo si llega incompleto', async () => {
    const send = jest.fn().mockResolvedValueOnce(reply(3, 0)).mockResolvedValueOnce(reply(15, 2));
    await expect(createProvider(env(), send)!.respond('plan', {})).resolves.toMatchObject({ message: '15/2' });
    expect(send.mock.calls.map(model)).toEqual(['listo', 'medio']);
  });

  it('si ninguno llega al mínimo devuelve el más completo en vez de fallar', async () => {
    const send = jest.fn().mockResolvedValueOnce(reply(3, 0)).mockResolvedValueOnce(reply(6, 1)).mockResolvedValueOnce(reply(2, 1));
    await expect(createProvider(env(), send)!.respond('plan', {})).resolves.toMatchObject({ message: '6/1' });
  });

  it('no hace esperar más de un minuto buscando un plan completo si ya tiene uno', async () => {
    let t = 0;
    const send = jest.fn(async () => { t += 40_000; return reply(5, 1); });
    await expect(createProvider(env(), send as unknown as typeof fetch, () => t)!.respond('plan', {})).resolves.toMatchObject({ message: '5/1' });
    expect(send).toHaveBeenCalledTimes(2); // a los 80 s ya no prueba el tercero
  });
});
