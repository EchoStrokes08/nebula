import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { authenticate, body, headers, json } from '../_shared/http.ts';
import { createProvider } from './provider.ts';
import { verifyPlanLinks } from './links.ts';
import { toLegacyResponse } from '../../../src/domain/capture/legacy.ts';
import { busyFromTasks, schedulePlan, type SchedulePlan } from '../../../src/domain/capture/schedule.ts';
import { assistantContextSchema, historySchema } from '../../../src/domain/assistant/context.ts';

const legacyContext = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), tasksCompleted: z.number().int().min(0).max(100000), habitRecords: z.number().int().min(0).max(100000), activeDays: z.number().int().min(0).max(7) }).strict();
const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  // Clientes antiguos envían solo el resumen numérico; los nuevos, el contexto completo.
  context: z.union([assistantContextSchema, legacyContext]),
  history: historySchema.optional(),
  /** Lo envían las apps 1.2.0+; sin él es una app antigua que necesita el formato anterior. */
  client: z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), platform: z.enum(['android', 'ios', 'web', 'desktop']) }).strict().optional(),
}).strict();
async function refundRequest(userId: string) {
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return;
  await createClient(url, key, { auth: { persistSession: false } }).rpc('refund_ai_request', { p_user: userId }).then(() => undefined, () => undefined);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const { client, user } = await authenticate(req);
    const parsed = requestSchema.safeParse(await body(req));
    if (!parsed.success) return json({ error: 'invalid request' }, 400);
    const provider = createProvider((k) => Deno.env.get(k));
    if (!provider) return json({ error: 'provider not configured', fallback: 'captura' }, 503);
    const { data, error } = await client.rpc('consume_ai_request');
    if (error) return json({ error: 'AI disabled or unavailable' }, 403);
    if (!data) return json({ error: 'daily limit reached' }, 429);
    let result: { actions: { type: string }[] };
    try {
      result = await provider.respond(parsed.data.message, parsed.data.context, parsed.data.history ?? []) as { actions: { type: string }[] };
    } catch {
      // Todos los modelos fallaron: la consulta no cuenta para el límite diario.
      await refundRequest(user.id);
      return json({ error: 'all models busy', fallback: 'captura' }, 503);
    }
    // Los enlaces de estudio se comprueban aquí: el cliente solo ve los que responden.
    await verifyPlanLinks(result);
    // Las fechas del plan se ajustan a la semana real de la persona (días activos y carga).
    const ctx = parsed.data.context;
    if ('now' in ctx) {
      for (const a of result.actions) {
        if (a.type === 'create_plan') schedulePlan(a as unknown as SchedulePlan, { today: ctx.now.day, activeDays: ctx.person.activeDays, busy: busyFromTasks(ctx.tasks) });
      }
    }
    return json(parsed.data.client ? result : toLegacyResponse(result as { message: string; actions: { type: string }[] }));
  } catch (e) {
    return json({ error: e instanceof Error && e.message === 'unauthorized' ? 'unauthorized' : 'assistant unavailable', fallback: 'captura' }, e instanceof Error && e.message === 'unauthorized' ? 401 : 503);
  }
});
