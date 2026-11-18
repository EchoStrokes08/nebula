// Prueba sintética de los planes para metas: pide un plan al proveedor principal (sin respaldo),
// comprueba los enlaces como lo hace ai-assist y muestra el resultado. No escribe datos.
import { readFileSync } from 'node:fs';
import { createProvider } from '../supabase/functions/ai-assist/provider.ts';
import { verifyPlanLinks } from '../supabase/functions/ai-assist/links.ts';
const env = Object.fromEntries(readFileSync(new URL('../.env.server.local', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const only = (k) => (k.startsWith('AI_FALLBACK_') ? undefined : env[k]);
const goal = process.argv[2] ?? 'Aprender inglés para trabajar en tecnología';
const today = new Date().toISOString().slice(0, 10);
const context = {
  now: { date: today, time: '18:00', weekday: 'martes', part: 'tarde' },
  person: { name: 'Prueba', about: 'Trabajo de 9 a 17, tengo tiempo por las tardes.', tone: 'cercano', activeDays: [1, 2, 3, 4, 5], focusWindows: ['tarde'] },
  habits: [], tasks: [], goals: [], agenda: [],
};
const started = Date.now();
const result = await createProvider(only).respond(`No sé bien cómo lograr una meta. Créame un plan con hitos, tareas, hábitos, qué estudiar y sitios web donde hacerlo. Mi meta es: ${goal}`, context);
const plan = result.actions.find((a) => a.type === 'create_plan');
if (!plan) { console.error('El modelo no devolvió create_plan.'); console.log(result.message); process.exit(1); }
const before = [plan, ...plan.tasks, ...plan.habits].flatMap((l) => l.resources.map((r) => r.url));
const dropped = await verifyPlanLinks(result);
console.log(`${env.AI_MODEL}: ${((Date.now() - started) / 1000).toFixed(1)} s · ${before.length} enlaces, ${dropped} descartados`);
console.log(JSON.stringify(result, null, 2));
