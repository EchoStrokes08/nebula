import { assistantErrorKind, assistantErrorMessage, readAssistantFailure } from './errors';

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
