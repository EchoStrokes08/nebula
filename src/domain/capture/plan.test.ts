import { cleanOutput, createProvider } from '../../../supabase/functions/ai-assist/provider';
import { isPublicHttps, verifyPlanLinks } from '../../../supabase/functions/ai-assist/links';
import { assistanceSchema, planSchema, type PlanAction } from './actions';
import { samplePlan } from './plan.fixture';


describe('acción create_plan', () => {
  it('acepta un plan completo y solo enlaces https públicos', () => {
    expect(planSchema.safeParse(samplePlan).success).toBe(true);
    const http = { ...samplePlan, resources: [{ title: 'x', url: 'http://example.com', note: null }] };
    expect(planSchema.safeParse(http).success).toBe(false);
    const js = { ...samplePlan, resources: [{ title: 'x', url: 'javascript:alert(1)', note: null }] };
    expect(planSchema.safeParse(js).success).toBe(false);
  });
  it('descarta recursos inválidos del modelo sin perder el plan y tolera vallas ```json', () => {
    const bad = { ...samplePlan, resources: [...samplePlan.resources, { title: 'Roto', url: 'ftp://x', note: null }], tasks: [{ ...samplePlan.tasks[0], resources: [{ title: 'Sin url' }] }] };
    const parsed = assistanceSchema.parse(cleanOutput('```json\n' + JSON.stringify({ message: 'ok', actions: [bad] }) + '\n```'));
    const plan = parsed.actions[0] as PlanAction;
    expect(plan.resources).toHaveLength(1);
    expect(plan.tasks[0]!.resources).toHaveLength(0);
  });
});

describe('proveedor', () => {
  const answer = (content: unknown) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) });
  it('usa el endpoint compatible de Google por defecto y cae a Groq si falla', async () => {
    const env = (k: string) => ({ AI_PROVIDER: 'google', AI_MODEL: 'gemini-4-hydrogen', AI_API_KEY: 'g', AI_FALLBACK_PROVIDER: 'groq', AI_FALLBACK_MODEL: 'openai/gpt-oss-120b', AI_FALLBACK_API_KEY: 'q' } as Record<string, string>)[k];
    const send = jest.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce(answer({ message: 'Hola', actions: [] }));
    await expect(createProvider(env, send)!.respond('hola', {})).resolves.toEqual({ message: 'Hola', actions: [] });
    expect(send.mock.calls[0]![0]).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(JSON.parse(send.mock.calls[0]![1].body).model).toBe('gemini-4-hydrogen');
    expect(send.mock.calls[1]![0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(send.mock.calls[1]![1].headers.Authorization).toBe('Bearer q');
  });
  it('las instrucciones piden planes con recursos reales', async () => {
    const env = (k: string) => ({ AI_PROVIDER: 'google', AI_MODEL: 'm', AI_API_KEY: 'k' } as Record<string, string>)[k];
    const send = jest.fn().mockResolvedValue(answer({ message: 'x', actions: [samplePlan] }));
    const r = await createProvider(env, send)!.respond('Quiero aprender Python', {});
    expect(assistanceSchema.parse(r).actions[0]!.type).toBe('create_plan');
    const system = JSON.parse(send.mock.calls[0]![1].body).messages[0].content as string;
    expect(system).toMatch(/create_plan/);
    expect(system).toMatch(/NUNCA inventes URLs/);
  });
});

describe('comprobación de enlaces', () => {
  it('rechaza hosts internos, IPs y puertos raros sin hacer peticiones', () => {
    expect(isPublicHttps('https://docs.python.org/es/3/')).toBe(true);
    expect(isPublicHttps('https://127.0.0.1/x')).toBe(false);
    expect(isPublicHttps('https://metadata.google.internal/')).toBe(false);
    expect(isPublicHttps('https://example.com:8080/')).toBe(false);
    expect(isPublicHttps('http://example.com/')).toBe(false);
  });
  it('quita los 404 y los que no resuelven; conserva los que bloquean bots', async () => {
    const plan = JSON.parse(JSON.stringify({ ...samplePlan, resources: [
      { title: 'Bien', url: 'https://ok.example.com/', note: null },
      { title: 'Inventado', url: 'https://ok.example.com/no-existe', note: null },
      { title: 'Bloquea bots', url: 'https://cf.example.com/', note: null },
      { title: 'Sin DNS', url: 'https://nada.example.com/', note: null },
    ] }));
    const send = jest.fn(async (url: string, init: { method: string }) => {
      if (url.includes('nada')) throw new TypeError('dns');
      if (url.includes('no-existe')) return { status: 404 };
      if (url.includes('cf.')) return { status: 403 };
      if (url.includes('python.org') && init.method === 'HEAD') return { status: 405 };
      return { status: 200 };
    });
    const dropped = await verifyPlanLinks({ actions: [plan] }, send as unknown as typeof fetch);
    expect(dropped).toBe(2);
    expect(plan.resources.map((r: { title: string }) => r.title)).toEqual(['Bien', 'Bloquea bots']);
    expect(plan.tasks[0].resources).toHaveLength(1); // 405 a HEAD → reintenta con GET
    expect(send).toHaveBeenCalledWith('https://www.python.org/downloads/', expect.objectContaining({ method: 'GET' }));
  });
});
