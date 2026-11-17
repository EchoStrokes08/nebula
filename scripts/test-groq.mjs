import { readFileSync } from 'node:fs';
import { createProvider } from '../supabase/functions/ai-assist/provider.ts';
const env = Object.fromEntries(readFileSync(new URL('../.env.server.local', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
try {
  const provider = createProvider((k) => env[k]);
  if (!provider) throw new Error('Falta la configuración de Groq.');
  const result = await provider.respond('Crea una tarea titulada Leer documentación mañana, durante 20 minutos. Hoy es 2026-11-16. Propón la tarea sin ejecutarla.', { from: '2026-11-10', to: '2026-11-16', tasksCompleted: 0, habitRecords: 0, activeDays: 0 });
  if (!result.actions.some((a) => a.type === 'create_task')) throw new Error('El proveedor no devolvió la acción esperada.');
  console.log(`Groq responde con acciones válidas (${env.AI_MODEL}); no se ha ejecutado ninguna acción.`);
} catch {
  console.error('No se pudo validar Groq. Comprueba conexión, cuota, modelo y configuración privada.');
  process.exitCode = 1;
}
