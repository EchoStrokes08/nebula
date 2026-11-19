import { cleanOutput, createProvider } from '../../../supabase/functions/ai-assist/provider';
import { isPublicHttps, isSoft404, pageInfo, probeUrl, verifyPlanLinks, videoCheckUrl, youtubeSearch } from '../../../supabase/functions/ai-assist/links';
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
    // Planes detallados: pasos, criterio de terminado, dependencias y muchos recursos.
    expect(system).toMatch(/steps/);
    expect(system).toMatch(/8-15 recursos/);
    // El esquema que ve el modelo es el de entrada: los campos nuevos son opcionales.
    expect(system).toContain('"steps"');
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
  it('reconoce los enlaces de vídeo y los comprueba con oEmbed', () => {
    expect(videoCheckUrl('https://www.youtube.com/watch?v=abc')).toBe('https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc');
    expect(videoCheckUrl('https://youtu.be/abc')).toContain('youtube.com/oembed');
    expect(videoCheckUrl('https://m.youtube.com/shorts/abc')).toContain('youtube.com/oembed');
    expect(videoCheckUrl('https://www.youtube.com/playlist?list=PL1')).toContain('youtube.com/oembed');
    expect(videoCheckUrl('https://vimeo.com/76979871')).toContain('vimeo.com/api/oembed.json');
    // Canales y búsquedas sí dan 404 de verdad: van por la comprobación normal.
    expect(videoCheckUrl('https://www.youtube.com/@freecodecamp')).toBeNull();
    expect(videoCheckUrl('https://www.youtube.com/results?search_query=python')).toBeNull();
    expect(videoCheckUrl('https://docs.python.org/es/3/')).toBeNull();
  });
  it('cambia los vídeos que no se pueden ver por una búsqueda en YouTube', async () => {
    const plan = JSON.parse(JSON.stringify({ ...samplePlan, tasks: [], habits: [], resources: [
      { title: 'Vídeo real', url: 'https://www.youtube.com/watch?v=real', note: '[Vídeo] x' },
      { title: 'Python desde cero', url: 'https://www.youtube.com/watch?v=inventado', note: '[Vídeo] y' },
      { title: 'Vídeo privado', url: 'https://vimeo.com/123', note: null },
      { title: 'Web rota', url: 'https://ok.example.com/no-existe', note: null },
    ] }));
    const send = jest.fn(async (url: string) => {
      if (url.includes('oembed')) return { status: url.includes('real') ? 200 : url.includes('vimeo') ? 403 : 404 };
      return { status: url.includes('no-existe') ? 404 : 200 };
    });
    const dropped = await verifyPlanLinks({ actions: [plan] }, send as unknown as typeof fetch);
    expect(dropped).toBe(1);
    expect(plan.resources.map((r: { url: string }) => r.url)).toEqual([
      'https://www.youtube.com/watch?v=real',
      youtubeSearch('Python desde cero'),
      youtubeSearch('Vídeo privado'),
    ]);
    expect(plan.resources[1].note).toMatch(/^\[Búsqueda en YouTube\]/);
    // Nunca se pide la página del vídeo: dice 200 aunque no exista.
    expect(send).not.toHaveBeenCalledWith('https://www.youtube.com/watch?v=inventado', expect.anything());
  });
  it('detecta las páginas que responden 200 pero no existen (soft 404)', () => {
    // learngerman.dw.com: armazón vacío con 200; la ruta inventada da 404 con el mismo título.
    const shell = '<html><head><title>DW Learn German</title><meta name="author" content="DW"></head><body><div id="root"></div></body></html>';
    const dw404 = pageInfo(404, null, '<title>DW Learn German</title><h1 class="x">404 - Página no encontrada</h1>');
    const dwReal = '<title>DW Learn German</title><meta name="description" content="Cursos"><link rel="canonical" href="https://learngerman.dw.com/es/x">';
    const url = 'https://learngerman.dw.com/es/placement-test';
    expect(isSoft404(url, pageInfo(200, url, shell), dw404)).toBe(true);
    expect(isSoft404(url, pageInfo(200, url, dwReal), dw404)).toBe(false);
    // git-scm.com: sin metadatos ni título propio, pero con contenido real (<h1>).
    expect(isSoft404('https://git-scm.com/book/es/v2', pageInfo(200, null, '<title>Git</title><h1>Book</h1>'), pageInfo(404, null, '<title>Git</title><h1>That page doesn’t exist.</h1>'))).toBe(false);
    // Título o encabezado que dicen «no encontrado».
    expect(isSoft404(url, pageInfo(200, null, '<title>Página no encontrada | Sitio</title>'), null)).toBe(true);
    expect(isSoft404(url, pageInfo(200, null, '<title>Sitio</title><h1>Error 404</h1>'), null)).toBe(true);
    expect(isSoft404(url, pageInfo(200, null, '<title>Python</title><h1>Bucles for</h1>'), null)).toBe(false);
    // Ruta profunda que redirige a la portada.
    expect(isSoft404('https://ej.com/curso/leccion-1', pageInfo(200, 'https://ej.com/', '<title>Ej</title><h1>Hola</h1>'), null)).toBe(true);
    // Sitios que dan 200 a todo con la misma página (Khan Academy) o antibots: no se puede saber, se conservan.
    const khan = pageInfo(200, null, '<title>Khan Academy</title><meta name="description" content="x">');
    expect(isSoft404('https://www.khanacademy.org/math/algebra', khan, khan)).toBe(false);
    expect(isSoft404(url, pageInfo(200, null, '<title>Client Challenge</title>'), pageInfo(404, null, '<title>Client Challenge</title>'))).toBe(false);
  });
  it('compara con una ruta hermana inventada', () => {
    expect(probeUrl('https://learngerman.dw.com/es/placement-test')).toMatch(/^https:\/\/learngerman\.dw\.com\/es\/nebula-[a-z0-9]+$/);
    expect(probeUrl('https://ej.com/a/b/')).toMatch(/^https:\/\/ej\.com\/a\/nebula-[a-z0-9]+$/);
    expect(probeUrl('https://ej.com/')).toBeNull();
  });
});
