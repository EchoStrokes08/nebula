/**
 * Comprueba los enlaces de estudio que propone el modelo antes de enseñarlos.
 * Los modelos a veces recuerdan mal rutas profundas: se descartan los que dan 404/410,
 * errores 5xx o no resuelven. Se aceptan 401/403/429 (sitios que bloquean bots).
 *
 * Muchos sitios responden 200 a rutas que no existen («soft 404»): learngerman.dw.com, por
 * ejemplo, sirve el armazón de su app y pinta «404 - Page not found» con JavaScript. Por eso se
 * lee el principio del HTML (como mucho MAX_HTML) y se descarta la página si su título dice que
 * no existe, si redirige a la portada o si es igual que una ruta inventada del mismo sitio.
 * El contenido nunca se devuelve al cliente.
 *
 * Los vídeos son un caso aparte: YouTube y Vimeo responden 200 aunque el vídeo no exista, sea
 * privado o se haya borrado («Vídeo no disponible»). Para ellos se consulta su API oEmbed, que
 * solo da 200 si el vídeo se puede ver; si falla, el recurso se cambia por una búsqueda en YouTube.
 */
import type { PlanResource } from '../../../src/domain/capture/actions.ts';

const BLOCKED_HOST = /(^|\.)(localhost|local|internal|lan|home\.arpa|intranet|corp)$/i;
const MAX_LINKS = 150;
const CONCURRENCY = 16;
const MAX_HTML = 300_000;
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; NebulaLinkCheck/1.0)', Accept: 'text/html,*/*' };
const CHALLENGE = /client challenge|just a moment|attention required|verify(ing)? you are (a )?human|captcha|access denied/i;
const NOT_FOUND = /\b404\b|not found|page (does not|doesn.t|no longer) exists?|no (se ha )?(encontr|existe)|nicht gefunden|existiert nicht|introuvable|n.existe pas|non trovat|não (foi )?encontrad|niet gevonden/i;

export function isPublicHttps(url: string): boolean {
  const m = /^https:\/\/([^/?#:]+)(:\d+)?/i.exec(url);
  if (!m) return false;
  const host = m[1]!.toLowerCase().replace(/\.$/, '');
  // Sin IPs literales ni nombres internos: el servidor no debe sondear su propia red.
  if (/^[\d.]+$/.test(host) || host.includes('[') || BLOCKED_HOST.test(host)) return false;
  return !m[2] || m[2] === ':443';
}

/** URL de oEmbed para un vídeo o lista de YouTube/Vimeo; null si no es un enlace de vídeo. */
export function videoCheckUrl(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const path = u.pathname;
  const youtube = (host === 'youtube.com' && (/^\/(watch|playlist)$/.test(path) || /^\/(shorts|embed|live)\/[^/]+/.test(path)))
    || (host === 'youtu.be' && /^\/[^/]+/.test(path));
  if (youtube) return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  if (host === 'vimeo.com' && /^\/(\d+|channels\/[^/]+\/\d+)(\/|$)/.test(path)) return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
  return null;
}

/** Búsqueda en YouTube con el título del recurso: siempre lleva a vídeos reales sobre el tema. */
export const youtubeSearch = (title: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(title.trim())}`;

/** Lo que interesa de una respuesta HTML para saber si la página existe de verdad. */
export interface PageInfo { status: number; finalUrl: string | null; title: string; headings: string; identity: boolean; size: number }

const pick = (html: string, re: RegExp) => (re.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim();

export function pageInfo(status: number, finalUrl: string | null, html: string): PageInfo {
  const title = pick(html, /<title[^>]*>([^<]*)</i);
  const og = pick(html, /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)/i);
  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/gi)].slice(0, 3).map((m) => m[1]!.replace(/<[^>]+>/g, ' ')).join(' ');
  // Una página real suele identificarse (descripción, og:title o canonical); el armazón de una SPA o su 404, no.
  const identity = /<meta[^>]+(name=["']description["']|property=["']og:title["'])|<link[^>]+rel=["']canonical["']/i.test(html);
  return { status, finalUrl, title, headings: `${og} ${h1}`.replace(/\s+/g, ' ').trim(), identity, size: html.length };
}

/** true si la página responde 2xx pero en realidad es un «no encontrado». `probe` es una ruta inventada del mismo sitio. */
export function isSoft404(url: string, page: PageInfo, probe: PageInfo | null): boolean {
  if (CHALLENGE.test(page.title)) return false; // comprobación antibots: como un 403, no se puede saber
  if (NOT_FOUND.test(page.title) || NOT_FOUND.test(page.headings)) return true;
  // Una ruta profunda que acaba en la portada: el sitio no la conoce.
  try {
    const from = new URL(url);
    if (page.finalUrl && from.pathname.split('/').filter(Boolean).length >= 2 && new URL(page.finalUrl).pathname.replace(/\/+$/, '') === '') return true;
  } catch { /* URL inválida: ya se habría descartado */ }
  if (!probe || !page.title || page.title !== probe.title) return false;
  // El sitio sabe que la ruta inventada no existe (4xx) y esta página es un armazón vacío con su
  // mismo título: sin descripción ni canonical y sin ningún <h1> (el contenido lo pinta JavaScript).
  // Si responde 200 a todo con la misma página (Khan Academy, Duolingo), no se puede saber: se conserva.
  return probe.status >= 400 && !page.identity && !page.headings;
}

/** Ruta hermana que seguro no existe: misma carpeta, último tramo inventado. */
export function probeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    if (parts.filter(Boolean).length === 0) return null; // la portada no necesita comparación
    const last = parts.length - 1 - [...parts].reverse().findIndex(Boolean);
    parts[last] = `nebula-${Math.random().toString(36).slice(2, 10)}`;
    return `${u.origin}${parts.slice(0, last + 1).join('/')}`;
  } catch {
    return null;
  }
}

async function readHtml(r: Response): Promise<string> {
  const type = r.headers?.get?.('content-type') ?? '';
  if (!r.body || (type && !/html/i.test(type))) { await r.body?.cancel().catch(() => undefined); return ''; }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  try {
    while (html.length < MAX_HTML) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return html;
}

async function fetchPage(url: string, send: typeof fetch, timeoutMs: number): Promise<PageInfo & { html: boolean }> {
  const r = await send(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: HEADERS });
  // También se lee una página de error: la de la ruta inventada sirve para comparar.
  const html = r.status < 500 ? await readHtml(r) : (await r.body?.cancel().catch(() => undefined), '');
  return { ...pageInfo(r.status, typeof r.url === 'string' && r.url ? r.url : null, html), html: html.length > 0 };
}

/** Comparaciones con rutas inventadas, compartidas por los enlaces de la misma carpeta. */
export type ProbeCache = Map<string, Promise<PageInfo | null>>;

export async function linkWorks(url: string, send: typeof fetch, timeoutMs = 6000, probes: ProbeCache = new Map()): Promise<boolean> {
  if (!isPublicHttps(url)) return false;
  const oembed = videoCheckUrl(url);
  if (oembed) {
    try {
      const r = await send(oembed, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { ...HEADERS, Accept: 'application/json' } });
      await r.body?.cancel().catch(() => undefined);
      return r.status === 200;
    } catch {
      return false;
    }
  }
  try {
    const page = await fetchPage(url, send, timeoutMs);
    if (page.status >= 300) return page.status < 400 || page.status === 401 || page.status === 403 || page.status === 429;
    if (!page.html) return true; // PDF, imagen u otro contenido: basta con el 200
    const probe = probeUrl(url);
    let probed: Promise<PageInfo | null> | undefined;
    if (probe) {
      const key = probe.slice(0, probe.lastIndexOf('/'));
      probed = probes.get(key);
      if (!probed) {
        probed = fetchPage(probe, send, timeoutMs).catch(() => null);
        probes.set(key, probed);
      }
    }
    return !isSoft404(url, page, probed ? await probed : null);
  } catch {
    return false;
  }
}

interface WithResources { resources: PlanResource[] }
interface PlanLike extends WithResources { type: 'create_plan'; tasks: WithResources[]; habits: WithResources[] }

/**
 * Filtra en sitio los recursos rotos de cada `create_plan`. Un vídeo que no se puede ver se
 * cambia por una búsqueda en YouTube de su título; el resto de enlaces rotos se descartan.
 * Devuelve cuántos se descartaron.
 */
export async function verifyPlanLinks(result: { actions: { type: string }[] }, send: typeof fetch = fetch): Promise<number> {
  const plans = result.actions.filter((a): a is PlanLike => a.type === 'create_plan');
  const lists = plans.flatMap((p) => [p, ...p.tasks, ...p.habits]);
  const urls = [...new Set(lists.flatMap((l) => l.resources.map((r) => r.url)))].slice(0, MAX_LINKS);
  if (!urls.length) return 0;
  // Planes grandes traen muchos enlaces: se comprueban en tandas para no saturar la función.
  const ok = new Map<string, boolean>();
  const probes: ProbeCache = new Map();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, async () => {
    while (next < urls.length) { const u = urls[next++]!; ok.set(u, await linkWorks(u, send, 6000, probes)); }
  }));
  let dropped = 0;
  for (const l of lists) {
    const kept: PlanResource[] = [];
    for (const r of l.resources) {
      if (ok.get(r.url) === true) kept.push(r);
      else if (ok.has(r.url) && videoCheckUrl(r.url) && isPublicHttps(r.url)) {
        const search = youtubeSearch(r.title);
        if (!kept.some((k) => k.url === search)) kept.push({ title: r.title, url: search, note: `[Búsqueda en YouTube] El vídeo propuesto no está disponible; aquí tienes vídeos sobre «${r.title}».`.slice(0, 200) });
      } else dropped++;
    }
    l.resources = kept;
  }
  return dropped;
}
