import { createClient } from '@supabase/supabase-js';
export const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
export async function authenticate(req: Request) {
  const token = req.headers.get('Authorization') ?? '';
  if (!token.startsWith('Bearer ')) throw new Error('unauthorized');
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: token } }, auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token.slice(7));
  if (error || !data.user) throw new Error('unauthorized');
  return { client, user: data.user };
}
export async function body(req: Request) {
  const text = await req.text();
  if (text.length > 64000) throw new Error('body too large');
  return JSON.parse(text);
}
