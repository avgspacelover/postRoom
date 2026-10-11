import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function redirectApp(appUrl: string, status: string, platform: string, reason = '') {
  const target = new URL(appUrl);
  target.searchParams.set('postroom_connection', status);
  target.searchParams.set('platform', platform);
  if (reason) target.searchParams.set('reason', reason.slice(0, 180));
  target.hash = 'settings';
  return Response.redirect(target.toString(), 302);
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const appUrl = Deno.env.get('APP_URL');
  if (!supabaseUrl || !serviceKey || !appUrl) return new Response('OAuth callback is not configured', { status: 503 });

  const callbackUrl = new URL(request.url);
  const state = callbackUrl.searchParams.get('state') ?? '';
  const code = callbackUrl.searchParams.get('code') ?? '';
  const providerError = callbackUrl.searchParams.get('error_description') ?? callbackUrl.searchParams.get('error') ?? '';
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: stateRow, error: stateError } = await admin.from('platform_oauth_states').select('*').eq('state', state).maybeSingle();
  if (stateError || !stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) return redirectApp(appUrl, 'error', 'unknown', 'expired_or_invalid_state');
  await admin.from('platform_oauth_states').delete().eq('state', state);
  if (providerError || !code) return redirectApp(appUrl, 'error', stateRow.platform, 'authorization_cancelled');

  try {
    let tokenData: Record<string, unknown>;
    let platformUserId = '';
    let username = '';
    let expiresIn = 0;
    if (stateRow.platform === 'x') {
      const clientId = Deno.env.get('X_CLIENT_ID')!;
      const clientSecret = Deno.env.get('X_CLIENT_SECRET')!;
      const form = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: `${supabaseUrl}/functions/v1/platform-oauth-callback`, code_verifier: stateRow.code_verifier });
      const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` }, body: form,
      });
      const token = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(token.error_description ?? 'X token exchange failed');
      const profileResponse = await fetch('https://api.x.com/2/users/me?user.fields=username,name', { headers: { Authorization: `Bearer ${token.access_token}` } });
      const profile = await profileResponse.json();
      if (!profileResponse.ok || !profile.data?.id) throw new Error('Could not read the X account profile');
      tokenData = { access_token: token.access_token, refresh_token: token.refresh_token, token_type: token.token_type };
      platformUserId = profile.data.id; username = profile.data.username; expiresIn = Number(token.expires_in ?? 7200);
    } else if (stateRow.platform === 'instagram') {
      const form = new URLSearchParams({
        client_id: Deno.env.get('META_APP_ID')!, client_secret: Deno.env.get('META_APP_SECRET')!,
        grant_type: 'authorization_code', redirect_uri: `${supabaseUrl}/functions/v1/platform-oauth-callback`, code,
      });
      const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form });
      const token = await tokenResponse.json();
      if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_message ?? 'Instagram token exchange failed');
      const longUrl = new URL('https://graph.instagram.com/access_token');
      longUrl.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: Deno.env.get('META_APP_SECRET')!, access_token: token.access_token }).toString();
      const longResponse = await fetch(longUrl);
      const longToken = await longResponse.json();
      if (!longResponse.ok || !longToken.access_token) throw new Error('Could not exchange Instagram token');
      const profileUrl = new URL('https://graph.instagram.com/me');
      profileUrl.search = new URLSearchParams({ fields: 'user_id,username', access_token: longToken.access_token }).toString();
      const profileResponse = await fetch(profileUrl);
      const profile = await profileResponse.json();
      if (!profileResponse.ok || !(profile.user_id ?? profile.id)) throw new Error('Could not read the Instagram professional account');
      tokenData = { access_token: longToken.access_token, token_type: longToken.token_type };
      platformUserId = String(profile.user_id ?? profile.id); username = profile.username ?? ''; expiresIn = Number(longToken.expires_in ?? 5184000);
    } else throw new Error('Unsupported platform');

    const { error } = await admin.from('platform_connections').upsert({
      user_id: stateRow.user_id, platform: stateRow.platform, platform_user_id: platformUserId,
      username, token_data: tokenData, expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(), updated_at: new Date().toISOString(),
    });
    if (error) throw new Error('Could not save the account connection');
    return redirectApp(appUrl, 'connected', stateRow.platform);
  } catch (error) {
    console.error('Provider OAuth callback failed', error);
    return redirectApp(appUrl, 'error', stateRow.platform, error instanceof Error ? error.message : 'provider_error');
  }
});
