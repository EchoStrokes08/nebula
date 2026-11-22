// Prueba sintética de los planes para metas: pide un plan al proveedor principal (sin respaldo),
// comprueba los enlaces como lo hace ai-assist y muestra el resultado. No escribe datos.
import { readFileSync } from 'node:fs';
import { createProvider } from '../supabase/functions/ai-assist/provider.ts';
import { schedulePlan } from '../src/domain/capture/schedule.ts';
const testKey = process.env.GROQ_TEST_API_KEY;
const env = testKey ? { AI_PROVIDER: 'groq', AI_MODEL: 'openai/gpt-oss-120b', AI_API_KEY: testKey } : Object.fromEntries(readFileSync(new URL('../.env.server.local', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
// Solo un proveedor, sin respaldo: el principal o el indicado con --proveedor AI_FALLBACK_ / AI_FALLBACK2_.
const at = process.argv.indexOf('--proveedor');
const prefix = at > 0 ? process.argv.splice(at, 2)[1] : 'AI_';
const only = (k) => (k.startsWith('AI_FALLBACK') ? undefined : env[k.startsWith('AI_') && !['AI_TIMEOUT_MS', 'AI_MAX_TOKENS', 'AI_DEADLINE_MS', 'AI_CONNECT_TIMEOUT_MS'].includes(k) ? prefix + k.slice(3) : k]);
const goal = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'Aprender inglés para trabajar en tecnología';
const today = new Date().toISOString().slice(0, 10);
const context = {
  now: { day: today, time: '18:00', weekday: 'martes', partOfDay: 'tarde' },
  person: { name: 'Prueba', about: 'Trabajo de 9 a 17, tengo tiempo por las tardes.', tone: 'cercano', activeDays: [1, 2, 3, 4, 5], focusWindows: [{ start: '18:00', end: '19:00' }] },
  habits: [], tasks: [], goals: [], agenda: [],
};
const started = Date.now();
const result = await createProvider(only, fetch, Date.now, { groundPlans: true }).respond(`No sé bien cómo lograr una meta. Créame un plan con hitos, tareas, hábitos, qué estudiar y sitios web donde hacerlo. Mi meta es: ${goal}`, context);
const plan = result.actions.find((a) => a.type === 'create_plan');
if (!plan) { console.error('El modelo no devolvió create_plan.'); console.log(result.message); process.exit(1); }
const sources = new Set([plan, ...plan.tasks, ...plan.habits].flatMap((l) => l.resources.map((r) => r.url)));
schedulePlan(plan, { today, activeDays: context.person.activeDays, busy: {} });
const count = (l) => l.resources.length;
console.log(`hitos ${plan.milestones.length} · tareas ${plan.tasks.length} (pasos ${plan.tasks.reduce((n, t) => n + (t.steps?.length ?? 0), 0)}, con dependencias ${plan.tasks.filter((t) => t.after?.length).length}, con criterio ${plan.tasks.filter((t) => t.done).length}) · hábitos ${plan.habits.length} · recursos: plan ${count(plan)}, tareas ${plan.tasks.reduce((n, t) => n + count(t), 0)}, hábitos ${plan.habits.reduce((n, h) => n + count(h), 0)}`);
if (plan.adjustments.length) console.log('Ajustes:', plan.adjustments.join(' | '));
console.log(`${env[prefix + 'MODEL']}: ${((Date.now() - started) / 1000).toFixed(1)} s · ${sources.size} fuentes recuperadas`);
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else { console.log(result.message); for (const t of plan.tasks) console.log(`- [${t.day}] ${t.title} (${t.minutes} min, hito ${t.milestone}, tras ${JSON.stringify(t.after)}) · ${t.resources.length} recursos`); }
