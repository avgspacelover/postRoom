import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/http.ts';

async function refreshXToken(connection: Record<string, any>, admin: ReturnType<typeof createClient>, userId: string) {
  const token = connection.token_data;
  if (new Date(connection.expires_at).getTime() > Date.now() + 120_000) return token;
  if (!token.refresh_token) throw new Error('X authorization expired. Reconnect your X account.');
  const clientId = Deno.env.get('X_CLIENT_ID')!; const clientSecret = Deno.env.get('X_CLIENT_SECRET')!;
  const form = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token, client_id: clientId });
  const response = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` }, body: form,
  });
  const refreshed = await response.json();
  if (!response.ok) throw new Error(refreshed.error_description ?? 'Could not renew X authorization. Reconnect the account.');
  const saved = { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token ?? token.refresh_token, token_type: refreshed.token_type };
  await admin.from('platform_connections').update({ token_data: saved, expires_at: new Date(Date.now() + Number(refreshed.expires_in ?? 7200) * 1000).toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId).eq('platform', 'x');
  return saved;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = request.headers.get('Authorization'); const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!auth || !url || !anon || !service) return json({ error: 'Function environment is incomplete' }, 503);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Sign in required' }, 401);
  const body = await request.json().catch(() => ({}));
  if (body.platform !== 'x' && body.platform !== 'instagram') return json({ error: 'Direct publishing is not available for this platform' }, 400);
  const text = typeof body.text === 'string' ? body.text : '';
  if (body.platform === 'x' && (text.length < 1 || text.length > 280)) return json({ error: 'X posts must contain 1–280 characters' }, 400);
  if (body.platform === 'instagram' && typeof body.media !== 'string') return json({ error: 'Instagram publishing needs an image' }, 400);
  const admin = createClient(url, service);
  const { data: connection, error: connectionError } = await admin.from('platform_connections').select('*').eq('user_id', user.id).eq('platform', body.platform).maybeSingle();
  if (connectionError || !connection) return json({ error: 'Connect this account before publishing' }, 404);

  let uploadedObject: string | undefined;
  try {
    if (body.platform === 'x') {
      const token = await refreshXToken(connection, admin, user.id);
      const dailyLimit = Number(Deno.env.get('X_DAILY_POST_LIMIT') ?? '0');
      if (!Number.isInteger(dailyLimit) || dailyLimit < 1) return json({ error: 'X API publishing is off. Set a positive X_DAILY_POST_LIMIT to opt in and cap billable post requests.' }, 403);
      const { data: reserved, error: limitError } = await admin.rpc('reserve_x_publish', { p_daily_limit: dailyLimit });
      if (limitError) return json({ error: 'Could not apply the X API usage limit. Check the database migration.' }, 503);
      if (!reserved) return json({ error: `The app-wide rolling 24-hour X publish cap (${dailyLimit}) has been reached.` }, 429);
      const response = await fetch('https://api.x.com/2/tweets', { method: 'POST', headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const result = await response.json();
      if (!response.ok) return json({ error: result.detail ?? result.title ?? 'X rejected the post', provider: result }, response.status);
      return json({ ok: true, postId: result.data?.id, url: result.data?.id ? `https://x.com/${connection.username}/status/${result.data.id}` : undefined });
    }

    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.media);
    if (!match) return json({ error: 'Use a JPEG, PNG, or WebP image for Instagram' }, 400);
    const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    if (bytes.length > 1_500_000) return json({ error: 'Instagram image exceeds the 1.5 MB app limit' }, 413);
    const objectName = `${user.id}/${crypto.randomUUID()}.${match[1].split('/')[1]}`;
    uploadedObject = objectName;
    const { error: uploadError } = await admin.storage.from('postroom-media').upload(objectName, bytes, { contentType: match[1], upsert: true });
    if (uploadError) return json({ error: 'Could not upload image for Instagram. Check the storage bucket migration.' }, 500);
    const { data: publicFile } = admin.storage.from('postroom-media').getPublicUrl(objectName);
    const version = Deno.env.get('META_GRAPH_VERSION');
    if (!version) { await admin.storage.from('postroom-media').remove([objectName]); return json({ error: 'Set META_GRAPH_VERSION in Supabase Function secrets' }, 503); }
    const token = connection.token_data.access_token;
    const mediaUrl = new URL(`https://graph.instagram.com/${version}/${connection.platform_user_id}/media`);
    mediaUrl.search = new URLSearchParams({ image_url: publicFile.publicUrl, caption: text }).toString();
    const containerResponse = await fetch(mediaUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const container = await containerResponse.json();
    if (!containerResponse.ok || !container.id) { await admin.storage.from('postroom-media').remove([objectName]); return json({ error: container.error?.message ?? 'Instagram could not prepare this image' }, 400); }

    let ready = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const statusUrl = new URL(`https://graph.instagram.com/${version}/${container.id}`);
      statusUrl.search = new URLSearchParams({ fields: 'status_code' }).toString();
      const statusResponse = await fetch(statusUrl, { headers: { Authorization: `Bearer ${token}` } }); const status = await statusResponse.json();
      if (status.status_code === 'FINISHED') { ready = true; break; }
      if (status.status_code === 'ERROR') break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    if (!ready) { await admin.storage.from('postroom-media').remove([objectName]); return json({ error: 'Instagram is still processing the image. Try publishing again shortly.' }, 502); }
    const publishUrl = new URL(`https://graph.instagram.com/${version}/${connection.platform_user_id}/media_publish`);
    publishUrl.search = new URLSearchParams({ creation_id: container.id }).toString();
    const publishResponse = await fetch(publishUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); const published = await publishResponse.json();
    await admin.storage.from('postroom-media').remove([objectName]);
    if (!publishResponse.ok || !published.id) return json({ error: published.error?.message ?? 'Instagram could not publish the post' }, 400);
    return json({ ok: true, postId: published.id });
  } catch (error) {
    if (uploadedObject) await admin.storage.from('postroom-media').remove([uploadedObject]);
    console.error('Direct publish failed', error);
    return json({ error: error instanceof Error ? error.message : 'Direct publishing failed' }, 500);
  }
});
