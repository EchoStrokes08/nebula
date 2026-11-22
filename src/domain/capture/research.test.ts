import { createProvider } from '../../../supabase/functions/ai-assist/provider';
import { planSchema } from './actions';
import { samplePlan } from './plan.fixture';

const source = {
  title: 'El tutorial de Python', url: 'https://docs.python.org/es/3/tutorial/',
  content: 'El tutorial oficial de Python incluye introducción, control de flujo, funciones y estructuras de datos con ejercicios de práctica.',
};
const fabricated = 'https://docs.python.org/es/3/leccion-inventada';

const evidence = {
  choices: [{ message: {
    content: `${source.url}\n${fabricated}`,
    executed_tools: [{ browser_results: [source] }],
  } }],
};
const plan = planSchema.parse({
  ...samplePlan,
  why: 'Construye y prueba un script que transforma un archivo CSV.',
  day: '2026-12-05',
  tasks: Array.from({ length: 3 }, (_, i) => ({
    ...samplePlan.tasks[0], title: `Programa la función ${i + 1}`, minutes: 30,
    study: 'Aplica la sección de control de flujo a los datos del CSV.',
    milestone: 0, after: i ? [i - 1] : [], steps: ['Prepara un CSV de tres filas', 'Ejecuta el script y compara la salida'],
    done: 'El script produce las tres filas esperadas.',
  })),
  resources: [
    { title: 'Nombre escrito por el modelo', url: source.url, note: 'Usa la sección de control de flujo.' },
    { title: 'Curso inexistente', url: fabricated, note: 'Haz la primera actividad.' },
  ],
});
const env = (k: string) => ({ AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-120b', AI_API_KEY: 'test-only' } as Record<string, string>)[k];
const completion = (action: typeof plan) => ({
  choices: [{ message: { content: JSON.stringify({ message: 'Empieza con el CSV.', actions: [action] }) } }],
});

it('fundamenta la propuesta en el contenido de búsqueda y descarta enlaces escritos por el modelo', async () => {
  const send = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => evidence })
    .mockResolvedValueOnce({ ok: true, json: async () => completion(plan) });
  const result = await createProvider(env, send, Date.now, { groundPlans: true })!.respond('Quiero aprender Python', {});
  expect(result).toMatchObject({ actions: [{ resources: [{ title: source.title, url: source.url, note: expect.any(String) }] }] });
  expect(JSON.parse(send.mock.calls[0]![1].body).tools).toEqual([{ type: 'browser_search' }]);
  expect(send.mock.calls[1]![1].body).toContain(source.content);
});

it('se abstiene de publicar una propuesta con una tarea incompleta', async () => {
  const badPlan = { ...plan, tasks: plan.tasks.map((task) => ({ ...task, steps: [], done: null })) };
  const send = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => completion(badPlan) });
  await expect(createProvider(env, send, Date.now, { groundPlans: true })!.respond('Quiero aprender Python', {}))
    .resolves.toMatchObject({ actions: [] });
});
