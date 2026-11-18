/**
 * Comprueba los enlaces de estudio que propone el modelo antes de enseñarlos.
 * Los modelos a veces recuerdan mal rutas profundas: se descartan los que dan 404/410,
 * errores 5xx o no resuelven. Se aceptan 401/403/429 (sitios que bloquean bots).
 * Solo se pide la cabecera de la respuesta; el contenido nunca se devuelve al cliente.
 */
import type { PlanResource } from '../../../src/domain/capture/actions.ts';

const BLOCKED_HOST = /(^|\.)(localhost|local|internal|lan|home\.arpa|intranet|corp)$/i;
const MAX_LINKS = 150;
const CONCURRENCY = 16;

export function isPublicHttps(url: string): boolean {
  const m = /^https:\/\/([^/?#:]+)(:\d+)?/i.exec(url);
  if (!m) return false;
  const host = m[1]!.toLowerCase().replace(/\.$/, '');
  // Sin IPs literales ni nombres internos: el servidor no debe sondear su propia red.
  if (/^[\d.]+$/.test(host) || host.includes('[') || BLOCKED_HOST.test(host)) return false;
  return !m[2] || m[2] === ':443';
}

export async function linkWorks(url: string, send: typeof fetch, timeoutMs = 6000): Promise<boolean> {
  if (!isPublicHttps(url)) return false;
  const attempt = async (method: 'HEAD' | 'GET') => {
    const r = await send(url, { method, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NebulaLinkCheck/1.0)', Accept: 'text/html,*/*' } });
    await r.body?.cancel().catch(() => undefined);
    return r.status;
  };
  try {
    let status = await attempt('HEAD');
    if (status === 405 || status === 501 || status === 400) status = await attempt('GET');
    return status < 400 || status === 401 || status === 403 || status === 429;
  } catch {
    return false;
  }
}

interface WithResources { resources: PlanResource[] }
interface PlanLike extends WithResources { type: 'create_plan'; tasks: WithResources[]; habits: WithResources[] }

/** Filtra en sitio los recursos rotos de cada `create_plan`. Devuelve cuántos se descartaron. */
export async function verifyPlanLinks(result: { actions: { type: string }[] }, send: typeof fetch = fetch): Promise<number> {
  const plans = result.actions.filter((a): a is PlanLike => a.type === 'create_plan');
  const lists = plans.flatMap((p) => [p, ...p.tasks, ...p.habits]);
  const urls = [...new Set(lists.flatMap((l) => l.resources.map((r) => r.url)))].slice(0, MAX_LINKS);
  if (!urls.length) return 0;
  // Planes grandes traen muchos enlaces: se comprueban en tandas para no saturar la función.
  const ok = new Map<string, boolean>();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, async () => {
    while (next < urls.length) { const u = urls[next++]!; ok.set(u, await linkWorks(u, send)); }
  }));
  let dropped = 0;
  for (const l of lists) {
    const kept = l.resources.filter((r) => ok.get(r.url) === true);
    dropped += l.resources.length - kept.length;
    l.resources = kept;
  }
  return dropped;
}
