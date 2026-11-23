import type { SupabaseClient } from '@supabase/supabase-js';
import { modelSpecs, type ModelSpec } from '../ai-assist/provider.ts';
import { json } from './http.ts';
import {
  MAX_MAIL_PER_RUN, mailForModel, normalizeTriage, parseModelJson, triageInstructions,
  type MailItem, type MailProvider, type TriageRow,
} from '../../../src/domain/mail/triage.ts';

/**
 * Parte común de gmail-triage y outlook-mail: descarta lo ya revisado, gasta una consulta de IA,
 * clasifica con los modelos configurados y guarda el resultado en mail_triage.
 */
const ATTEMPT_MS = 50_000;
const DEADLINE_MS = 110_000;

/** Pide la clasificación a los modelos configurados, en orden, hasta que uno responda bien. */
async function classify(specs: ModelSpec[], mail: MailItem[], today: string): Promise<TriageRow[] | null> {
  const start = Date.now();
  const system = triageInstructions(today);
  const input = JSON.stringify({ today, mail: mailForModel(mail) });
  for (const spec of specs) {
    const left = DEADLINE_MS - (Date.now() - start);
    if (left < 10_000) break;
    if (!spec.base.startsWith('https://')) continue;
    const isResponses = spec.provider === 'openai';
    const payload = isResponses
      ? { model: spec.model, store: false, instructions: system, input, max_output_tokens: 6000, text: { format: { type: 'json_object' } } }
      : { model: spec.model, messages: [{ role: 'system', content: system }, { role: 'user', content: input }], max_tokens: 6000, response_format: { type: 'json_object' } };
    try {
      const r = await fetch(`${spec.base.replace(/\/$/, '')}/${isResponses ? 'responses' : 'chat/completions'}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${spec.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(Math.min(ATTEMPT_MS, left - 2000)),
      });
      if (!r.ok) { console.log(JSON.stringify({ mail: 'fail', model: spec.id, status: r.status })); await r.body?.cancel().catch(() => undefined); continue; }
      const data = await r.json();
      const text: unknown = isResponses
        ? (data.output ?? []).flatMap((i: { content?: { type: string; text?: string }[] }) => i.content ?? []).filter((c: { type: string }) => c.type === 'output_text').map((c: { text: string }) => c.text).join('')
        : data.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) continue;
      const rows = normalizeTriage(parseModelJson(text), mail, today);
      if (rows.length) { console.log(JSON.stringify({ mail: 'ok', model: spec.id, rows: rows.length, ms: Date.now() - start })); return rows; }
      console.log(JSON.stringify({ mail: 'empty', model: spec.id }));
    } catch (e) {
      console.log(JSON.stringify({ mail: 'fail', model: spec.id, reason: e instanceof Error ? e.message : String(e) }));
    }
  }
  return null;
}

/** Ids de la lista que aún no están clasificados para este proveedor. */
export async function unseen(admin: SupabaseClient, userId: string, provider: MailProvider, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data, error } = await admin.from('mail_triage').select('message_id').eq('user_id', userId).eq('provider', provider).in('message_id', ids);
  if (error) throw error;
  const seen = new Set((data ?? []).map((k: { message_id: string }) => k.message_id));
  return ids.filter((id) => !seen.has(id));
}

/**
 * Clasifica `mail` (ya filtrado con `unseen` y como mucho MAX_MAIL_PER_RUN) y responde a la app.
 * `client` es el cliente de la persona (para su cuota de IA); `admin`, el de servicio.
 */
export async function triageAndSave(opts: {
  admin: SupabaseClient; client: SupabaseClient; userId: string; provider: MailProvider; mail: MailItem[]; today: string; pending: number;
}): Promise<Response> {
  const { admin, client, userId, provider, mail, today, pending } = opts;
  if (!mail.length) return json({ added: 0, pending });
  const specs = modelSpecs((k) => Deno.env.get(k));
  if (!specs.length) return json({ error: 'not_configured' }, 503);
  const quota = await client.rpc('consume_ai_request');
  if (quota.error) return json({ error: 'ai_disabled' }, 403);
  if (!quota.data) return json({ error: 'daily_limit' }, 429);
  const rows = await classify(specs, mail.slice(0, MAX_MAIL_PER_RUN), today);
  if (!rows) {
    // Ningún modelo respondió bien: la revisión no cuenta para el límite diario.
    await admin.rpc('refund_ai_request', { p_user: userId }).then(() => undefined, () => undefined);
    return json({ error: 'models_busy' }, 503);
  }
  const { error } = await admin.from('mail_triage').upsert(rows.map((row) => ({ ...row, user_id: userId, provider })), { onConflict: 'user_id,provider,message_id', ignoreDuplicates: true });
  if (error) throw error;
  return json({ added: rows.length, pending });
}
