import { fetchWithTimeout } from './fetchWithTimeout';

it('corta una petición que no responde', async () => {
  jest.useFakeTimers();
  const hanging = ((_i: unknown, init?: RequestInit) => new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('abortada'))))) as typeof fetch;
  const p = fetchWithTimeout(1000, hanging)('https://x');
  jest.advanceTimersByTime(1000);
  await expect(p).rejects.toThrow('abortada');
  jest.useRealTimers();
});
it('deja pasar las respuestas a tiempo', async () => {
  const ok = (async () => new Response('ok')) as typeof fetch;
  await expect((await fetchWithTimeout(1000, ok)('https://x')).text()).resolves.toBe('ok');
});
it('el límite puede depender de la URL (más margen para el asistente de IA)', async () => {
  jest.useFakeTimers();
  const hanging = ((_i: unknown, init?: RequestInit) => new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('abortada'))))) as typeof fetch;
  const f = fetchWithTimeout((url) => (url.includes('/functions/v1/ai-assist') ? 150_000 : 15_000), hanging);
  let aiDone = false;
  const ai = f('https://p.supabase.co/functions/v1/ai-assist').catch(() => { aiDone = true; });
  const rest = f('https://p.supabase.co/rest/v1/habits');
  jest.advanceTimersByTime(15_000);
  await expect(rest).rejects.toThrow('abortada');
  await Promise.resolve();
  expect(aiDone).toBe(false);
  jest.advanceTimersByTime(135_000);
  await ai;
  expect(aiDone).toBe(true);
  jest.useRealTimers();
});
