import { askWithRetry, assistantErrorKind, assistantErrorMessage, readAssistantFailure, retryDelay } from './errors';

describe('errores del asistente', () => {
  it('distingue cada código del servidor', () => {
    expect(assistantErrorKind({ status: 503, code: 'models_busy' })).toBe('models_busy');
    expect(assistantErrorKind({ status: 503, code: 'models_error' })).toBe('models_error');
    expect(assistantErrorKind({ status: 503, code: 'not_configured' })).toBe('not_configured');
    expect(assistantErrorKind({ status: 500, code: 'internal' })).toBe('internal');
    expect(assistantErrorKind({ status: 429, code: 'daily_limit' })).toBe('daily_limit');
    expect(assistantErrorKind({ status: 403, code: 'ai_disabled' })).toBe('ai_disabled');
    expect(assistantErrorKind({ status: 401, code: 'unauthorized' })).toBe('unauthorized');
  });

  it('sin respuesta del servidor es un problema de conexión, no de saturación', () => {
    expect(assistantErrorKind({ name: 'FunctionsFetchError' })).toBe('network');
    expect(assistantErrorMessage({ name: 'FunctionsFetchError' })).toMatch(/conexión/);
  });

  it('con servidores antiguos (sin code) usa el estado HTTP', () => {
    expect(assistantErrorKind({ status: 503 })).toBe('models_busy');
    expect(assistantErrorKind({ status: 429 })).toBe('daily_limit');
    expect(assistantErrorKind({ status: 502 })).toBe('internal');
    expect(assistantErrorKind({ status: 503, code: 'algo-nuevo' })).toBe('models_busy');
  });

  it('lee estado y código de un error de functions.invoke', async () => {
    const error = { name: 'FunctionsHttpError', context: new Response(JSON.stringify({ code: 'models_error' }), { status: 503 }) };
    await expect(readAssistantFailure(error)).resolves.toEqual({ status: 503, code: 'models_error', name: 'FunctionsHttpError' });
    await expect(readAssistantFailure({ name: 'FunctionsFetchError', context: new TypeError('fetch failed') })).resolves.toEqual({ status: undefined, code: undefined, name: 'FunctionsFetchError' });
    const html = { name: 'FunctionsRelayError', context: new Response('<html>', { status: 502 }) };
    await expect(readAssistantFailure(html)).resolves.toMatchObject({ status: 502, code: undefined });
  });
});

describe('reintento automático', () => {
  it('reintenta dos veces los fallos pasajeros rápidos, con esperas crecientes', () => {
    expect(retryDelay('models_busy', 3000, 0)).toBe(4000);
    expect(retryDelay('models_busy', 3000, 1)).toBe(10000);
    expect(retryDelay('models_busy', 3000, 2)).toBeNull();
    expect(retryDelay('network', 500, 0)).toBe(4000);
  });

  it('no reintenta si el intento ya tardó mucho ni ante errores que no se arreglan solos', () => {
    expect(retryDelay('models_busy', 50000, 0)).toBeNull();
    for (const kind of ['daily_limit', 'models_error', 'not_configured', 'ai_disabled', 'unauthorized', 'invalid_request', 'internal'] as const) {
      expect(retryDelay(kind, 1000, 0)).toBeNull();
    }
  });
});

describe('askWithRetry', () => {
  const busy = () => ({ data: null, error: { name: 'FunctionsHttpError', context: new Response(JSON.stringify({ code: 'models_busy' }), { status: 503 }) } });
  const done = { data: { message: 'hola' }, error: null };
  const sleep = jest.fn(async () => undefined);
  beforeEach(() => sleep.mockClear());

  it('se recupera sola de una saturación momentánea avisando mientras espera', async () => {
    const ask = jest.fn().mockResolvedValueOnce(busy()).mockResolvedValueOnce(done);
    const notices: string[] = [];
    await expect(askWithRetry(ask, (n) => notices.push(n), sleep, () => 0)).resolves.toBe(done);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(4000);
    expect(notices).toEqual(['Los modelos de IA están muy ocupados; reintentando en unos segundos…', '']);
  });

  it('tras dos reintentos muestra el error', async () => {
    const ask = jest.fn(async () => busy());
    await expect(askWithRetry(ask, undefined, sleep, () => 0)).rejects.toThrow(/saturados/);
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it('el límite diario no se reintenta', async () => {
    const ask = jest.fn(async () => ({ data: null, error: { name: 'FunctionsHttpError', context: new Response('{"code":"daily_limit"}', { status: 429 }) } }));
    await expect(askWithRetry(ask, undefined, sleep, () => 0)).rejects.toThrow(/20 consultas/);
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
