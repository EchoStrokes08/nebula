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
