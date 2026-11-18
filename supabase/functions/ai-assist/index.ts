import { z } from 'zod';
import { authenticate, body, headers, json } from '../_shared/http.ts';
import { createProvider } from './provider.ts';
import { assistantContextSchema, historySchema } from '../../../src/domain/assistant/context.ts';

const legacyContext = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), tasksCompleted: z.number().int().min(0).max(100000), habitRecords: z.number().int().min(0).max(100000), activeDays: z.number().int().min(0).max(7) }).strict();
const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  // Clientes antiguos envían solo el resumen numérico; los nuevos, el contexto completo.
  context: z.union([assistantContextSchema, legacyContext]),
  history: historySchema.optional(),
}).strict();
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const { client } = await authenticate(req);
    const parsed = requestSchema.safeParse(await body(req));
    if (!parsed.success) return json({ error: 'invalid request' }, 400);
    const provider = createProvider((k) => Deno.env.get(k));
    if (!provider) return json({ error: 'provider not configured', fallback: 'captura' }, 503);
    const { data, error } = await client.rpc('consume_ai_request');
    if (error) return json({ error: 'AI disabled or unavailable' }, 403);
    if (!data) return json({ error: 'daily limit reached' }, 429);
    return json(await provider.respond(parsed.data.message, parsed.data.context, parsed.data.history ?? []));
  } catch (e) {
    return json({ error: e instanceof Error && e.message === 'unauthorized' ? 'unauthorized' : 'assistant unavailable', fallback: 'captura' }, e instanceof Error && e.message === 'unauthorized' ? 401 : 503);
  }
});
