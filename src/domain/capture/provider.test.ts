import { createProvider } from '../../../supabase/functions/ai-assist/provider';
import { assistanceSchema } from './actions';
const env = (k: string) => ({ AI_PROVIDER: 'groq', AI_API_KEY: 'test-only', AI_MODEL: 'test-model', AI_BASE_URL: 'https://api.groq.com/openai/v1' })[k as 'AI_PROVIDER'];
it('usa Groq solo desde servidor, valida JSON y nunca aplica acciones', async () => {
  const send = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ message: 'Propuesta', actions: [{ type: 'create_goal', title: 'Estudiar', day: null, milestones: ['Leer'] }] }) } }] }) });
  const provider = createProvider(env, send)!;
  const result = await provider.respond('Crear meta', { tasksCompleted: 3 });
  expect(assistanceSchema.parse(result).actions).toHaveLength(1);
  expect(send).toHaveBeenCalledTimes(1);
  const [url, request] = send.mock.calls[0]!;
  expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  expect(JSON.parse(request.body).model).toBe('test-model');
});
it('rechaza propuestas inválidas y propaga fallos para usar captura local', async () => {
  const invalid = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"message":"x","actions":[{"type":"delete_all"}]}' } }] }) });
  await expect(createProvider(env, invalid)!.respond('x', {})).rejects.toThrow();
  const unavailable = jest.fn().mockResolvedValue({ ok: false });
  await expect(createProvider(env, unavailable)!.respond('x', {})).rejects.toThrow('provider unavailable');
});
it('sin credenciales no crea proveedor', () => { expect(createProvider(() => undefined)).toBeNull(); });
it('limita acciones y valida fechas civiles reales', () => {
  expect(assistanceSchema.safeParse({ message: 'x', actions: [{ type: 'create_goal', title: 'x', day: '2026-02-30', milestones: [] }] }).success).toBe(false);
  expect(assistanceSchema.safeParse({ message: 'x', actions: Array(13).fill({ type: 'create_goal', title: 'x', day: null, milestones: [] }) }).success).toBe(false);
});
