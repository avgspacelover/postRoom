import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { base64Url, corsHeaders, json } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!auth || !supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Supabase function environment is incomplete' }, 503);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Sign in before connecting an account' }, 401);

  const { platform } = await request.json().catch(() => ({ platform: '' }));
  if (platform !== 'x' && platform !== 'instagram') return json({ error: 'Only X and Instagram have configured official connectors' }, 400);

  const callback = `${supabaseUrl}/functions/v1/platform-oauth-callback`;
  const admin = createClient(supabaseUrl, serviceKey);
  const state = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  let url: URL;
  let verifier: string | null = null;

  if (platform === 'x') {
    const clientId = Deno.env.get('X_CLIENT_ID');
    if (!clientId || !Deno.env.get('X_CLIENT_SECRET')) return json({ error: 'Set X_CLIENT_ID and X_CLIENT_SECRET in Supabase Function secrets first' }, 503);
    verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = base64Url(new Uint8Array(digest));
    url = new URL('https://x.com/i/oauth2/authorize');
    url.search = new URLSearchParams({
      response_type: 'code', client_id: clientId, redirect_uri: callback,
      scope: 'tweet.read tweet.write users.read offline.access', state,
      code_challenge: challenge, code_challenge_method: 'S256',
    }).toString();
  } else {
    const appId = Deno.env.get('META_APP_ID');
    if (!appId || !Deno.env.get('META_APP_SECRET')) return json({ error: 'Set META_APP_ID and META_APP_SECRET in Supabase Function secrets first' }, 503);
    url = new URL('https://www.instagram.com/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: appId, redirect_uri: callback, response_type: 'code', state,
      scope: 'instagram_business_basic,instagram_business_content_publish',
    }).toString();
  }

  const { error } = await admin.from('platform_oauth_states').insert({
    state, user_id: user.id, platform, code_verifier: verifier,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) return json({ error: 'Could not start secure account connection' }, 500);
  return json({ url: url.toString() });
});
