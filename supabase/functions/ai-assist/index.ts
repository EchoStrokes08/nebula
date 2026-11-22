import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { authenticate, body, headers, json } from '../_shared/http.ts';
import { createProvider, ProviderUnavailable, type Attempt } from './provider.ts';
import { rankModels, type HealthRow } from './health.ts';
import { loadRevision } from './revision.ts';
import { toLegacyResponse } from '../../../src/domain/capture/legacy.ts';
import { normalizeActions, type ProposedAction } from '../../../src/domain/capture/actions.ts';
import { busyFromTasks, schedulePlan } from '../../../src/domain/capture/schedule.ts';
import { assistantContextSchema, historySchema } from '../../../src/domain/assistant/context.ts';

const legacyContext = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), tasksCompleted: z.number().int().min(0).max(100000), habitRecords: z.number().int().min(0).max(100000), activeDays: z.number().int().min(0).max(7) }).strict();
const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  // Clientes antiguos envían solo el resumen numérico; los nuevos, el contexto completo.
  context: z.union([assistantContextSchema, legacyContext]),
  history: historySchema.optional(),
  reviseGoal: z.uuid().optional(),
  /** Lo envían las apps 1.2.0+; sin él es una app antigua que necesita el formato anterior. */
  client: z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), platform: z.enum(['android', 'ios', 'web', 'desktop']) }).strict().optional(),
}).strict();
const admin = () => {
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
};
async function refundRequest(userId: string) {
  await admin()?.rpc('refund_ai_request', { p_user: userId }).then(() => undefined, () => undefined);
}

/** Salud de los modelos (revisada cada 6 h por ai-health); se relee como mucho cada 5 minutos. */
let healthCache: { at: number; rows: HealthRow[] } | null = null;
async function modelHealth(): Promise<HealthRow[]> {
  if (healthCache && Date.now() - healthCache.at < 5 * 60_000) return healthCache.rows;
  const db = admin();
  const { data } = db ? await db.from('ai_model_health').select('model, available, success_rate, latency_ms, checked_at').then((r) => r, () => ({ data: null })) : { data: null };
  healthCache = { at: Date.now(), rows: (data ?? []) as HealthRow[] };
  return healthCache.rows;
}

/** Guarda cada intento real para la próxima revisión, sin hacer esperar a la respuesta. */
function recordAttempts(attempts: Attempt[]) {
  const db = admin();
  if (!db || !attempts.length) return;
  const work = Promise.all(attempts.map((a) => db.rpc('record_ai_attempt', { p_model: a.model, p_outcome: a.outcome, p_ms: a.ms }).then(() => undefined, () => undefined)));
  (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(work);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const { client, user } = await authenticate(req);
    const parsed = requestSchema.safeParse(await body(req));
    if (!parsed.success) return json({ error: 'invalid request', code: 'invalid_request' }, 400);
    const ctx = parsed.data.context;
    const goalId = parsed.data.reviseGoal;
    if (goalId && (!parsed.data.client || !('now' in ctx))) return json({ code: 'invalid_request' }, 400);
    const rows = await modelHealth();
    const attempts: Attempt[] = [];
    const provider = createProvider((k) => Deno.env.get(k), fetch, Date.now, {
      groundPlans: true,
      order: (ids) => rankModels(ids, rows, Date.now()),
      onAttempt: (a) => attempts.push(a),
    });
    if (!provider) return json({ error: 'provider not configured', code: 'not_configured', fallback: 'captura' }, 503);
    const { data, error } = await client.rpc('consume_ai_request');
    if (error) return json({ error: 'AI disabled or unavailable', code: 'ai_disabled' }, 403);
    if (!data) return json({ error: 'daily limit reached', code: 'daily_limit' }, 429);
    let result: { message: string; actions: ProposedAction[] };
    try {
      const revision = goalId ? await loadRevision(client, user.id, goalId) : null;
      if (goalId && !revision) {
        await refundRequest(user.id);
        return json({ code: 'goal_unavailable' }, 404);
      }
      result = await provider.respond(parsed.data.message, revision ? { ...ctx, revision } : ctx, parsed.data.history ?? []) as typeof result;
      if (goalId && !result.actions.length) await refundRequest(user.id);
      recordAttempts(attempts);
    } catch (e) {
      recordAttempts(attempts);
      // Todos los modelos fallaron: la consulta no cuenta para el límite diario.
      await refundRequest(user.id);
      const busy = !(e instanceof ProviderUnavailable) || e.busy;
      return json(busy
        ? { error: 'all models busy', code: 'models_busy', fallback: 'captura' }
        : { error: 'all models rejected the request', code: 'models_error', fallback: 'captura' }, 503);
    }
    // Prioridades y longitudes dentro de los límites de la base de datos (si no, «aplicar» falla).
    normalizeActions(result.actions);
    // Las fechas del plan se ajustan a la semana real de la persona (días activos y carga).
    if ('now' in ctx) {
      for (const a of result.actions) {
        if (a.type !== 'create_plan') continue;
        const revisedTasks = new Set(a.tasks.map((t) => t.replaceId));
        schedulePlan(a, { today: ctx.now.day, activeDays: ctx.person.activeDays, busy: busyFromTasks(ctx.tasks.filter((t) => !revisedTasks.has(t.id))) });
        if (![a, ...a.tasks, ...a.habits].some((part) => part.resources.length)) {
          result.message = `${result.message.slice(0, 3800)}\n\nLa búsqueda no aportó fuentes verificables para esta propuesta.`;
        }
      }
    }
    return json(parsed.data.client ? result : toLegacyResponse(result as { message: string; actions: { type: string }[] }));
  } catch (e) {
    if (e instanceof Error && e.message === 'unauthorized') return json({ error: 'unauthorized', code: 'unauthorized' }, 401);
    console.log(JSON.stringify({ ai: 'internal', reason: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'assistant unavailable', code: 'internal', fallback: 'captura' }, 500);
  }
});
