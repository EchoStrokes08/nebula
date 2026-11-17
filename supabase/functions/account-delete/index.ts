import { createClient } from '@supabase/supabase-js';
import { authenticate, body, headers, json } from '../_shared/http.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const { user } = await authenticate(req);
    if ((await body(req)).confirmation !== 'ELIMINAR') return json({ error: 'confirmation required' }, 400);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    // Limpia Storage antes del borrado: Supabase no permite borrar usuarios propietarios de objetos.
    for (;;) {
      const { data, error } = await admin.storage.from('avatars').list(user.id, { limit: 100 });
      if (error) throw error;
      if (!data?.length) break;
      const removed = await admin.storage.from('avatars').remove(data.map((o) => `${user.id}/${o.name}`));
      if (removed.error) throw removed.error;
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return json({ deleted: true });
  } catch (e) { return json({ error: e instanceof Error && e.message === 'unauthorized' ? 'unauthorized' : 'account deletion failed' }, e instanceof Error && e.message === 'unauthorized' ? 401 : 500); }
});
