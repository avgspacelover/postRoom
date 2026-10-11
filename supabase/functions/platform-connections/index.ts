import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = request.headers.get('Authorization');
  const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!auth || !url || !anon || !service) return json({ error: 'Function environment is incomplete' }, 503);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Sign in required' }, 401);
  const admin = createClient(url, service);
  const body = await request.json().catch(() => ({}));
  if (body.action === 'disconnect') {
    if (body.platform !== 'x' && body.platform !== 'instagram') return json({ error: 'Unsupported provider' }, 400);
    const { error } = await admin.from('platform_connections').delete().eq('user_id', user.id).eq('platform', body.platform);
    return error ? json({ error: 'Could not disconnect account' }, 500) : json({ ok: true });
  }
  const { data, error } = await admin.from('platform_connections').select('platform, username, expires_at').eq('user_id', user.id);
  if (error) return json({ error: 'Could not read connections' }, 500);
  return json({ connections: data ?? [] });
});
