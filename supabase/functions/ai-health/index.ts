import { createClient } from '@supabase/supabase-js';
import { json } from '../_shared/http.ts';
import { modelSpecs, type ModelSpec } from '../ai-assist/provider.ts';
import { evaluate, MIN_TRAFFIC, probeModel, rankModels, trafficOf, type HealthRow } from '../ai-assist/health.ts';

/**
 * Revisión de salud de los modelos de IA, cada 6 horas (pg_cron + pg_net, ver la migración
 * `salud_modelos_ia`). Solo la llama el cron, con la cabecera `x-health-secret`.
 * Los proveedores se revisan en paralelo y los modelos de un mismo proveedor de uno en uno,
 * para no cargar a ninguno.
 */
Deno.serve(async (req) => {
  const secret = Deno.env.get('AI_HEALTH_SECRET');
  if (req.method !== 'POST' || !secret || req.headers.get('x-health-secret') !== secret) return json({ error: 'unauthorized' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const specs = modelSpecs((k) => Deno.env.get(k));
  const { data, error } = await db.from('ai_model_health').select('*');
  if (error) return json({ error: 'health table unavailable' }, 500);
  const rows = (data ?? []) as HealthRow[];

  const byProvider = new Map<string, ModelSpec[]>();
  for (const s of specs) byProvider.set(s.provider, [...(byProvider.get(s.provider) ?? []), s]);
  const checkedAt = new Date().toISOString();
  const results: (HealthRow & { source: string; note: string })[] = [];
  await Promise.all([...byProvider.values()].map(async (list) => {
    for (const spec of list) {
      const row = rows.find((r) => r.model === spec.id);
      const probe = trafficOf(row) >= MIN_TRAFFIC ? undefined : await probeModel(spec);
      const ev = evaluate(row, probe);
      results.push({ model: spec.id, available: ev.available, success_rate: ev.success_rate, latency_ms: ev.latency_ms, checked_at: checkedAt, source: ev.source, note: ev.note });
    }
  }));
  // Nueva ventana: los contadores vuelven a cero hasta la próxima revisión.
  const { error: saveError } = await db.from('ai_model_health').upsert(results.map((r) => ({
    ...r, ok_count: 0, busy_count: 0, error_count: 0, ms_total: 0, window_start: checkedAt,
  })));
  if (saveError) return json({ error: 'could not save health' }, 500);
  // Modelos que ya no están configurados.
  for (const r of rows) if (!specs.some((s) => s.id === r.model)) await db.from('ai_model_health').delete().eq('model', r.model);
  const order = rankModels(specs.map((s) => s.id), results, Date.now());
  console.log(JSON.stringify({ ai: 'health', order, results: results.map(({ model, available, source, note }) => ({ model, available, source, note })) }));
  return json({ order, results });
});
