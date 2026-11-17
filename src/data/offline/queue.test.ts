import { LogQueue, type PendingLog } from './queue';
const log = (id: string): PendingLog => ({ clientId: id, habitId: 'habit', dayKey: '2026-11-16', value: 1, tz: 'America/Bogota' });
function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); } };
  return { storage, queue: new LogQueue(storage, 'user-a') };
}
it('serializa escrituras concurrentes y evita duplicar client_id', async () => {
  const { queue } = fixture();
  await Promise.all([queue.add(log('1')), queue.add(log('2')), queue.add(log('1'))]);
  expect((await queue.list()).map((r) => r.clientId)).toEqual(['1', '2']);
});
it('conserva lo pendiente tras error y reinicio', async () => {
  const { queue, storage } = fixture();
  await queue.add(log('1')); await queue.add(log('2'));
  const send = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('red'));
  await expect(queue.flush(send, () => true)).rejects.toThrow('red');
  const restored = new LogQueue(storage, 'user-a');
  expect((await restored.list()).map((r) => r.clientId)).toEqual(['2']);
  await restored.flush(async () => {}, () => true);
  expect(await restored.list()).toEqual([]);
});
it('aísla cuentas y detiene el envío si cambia la sesión', async () => {
  const { queue, storage } = fixture();
  await queue.add(log('1')); await queue.add(log('2'));
  let current = true;
  await queue.flush(async () => { current = false; }, () => current);
  expect((await queue.list()).length).toBe(1);
  expect(await new LogQueue(storage, 'user-b').list()).toEqual([]);
});
it('permite deshacer antes de sincronizar', async () => {
  const { queue } = fixture(); await queue.add(log('1')); await queue.remove('1');
  const send = jest.fn(); await queue.flush(send, () => true); expect(send).not.toHaveBeenCalled();
});
