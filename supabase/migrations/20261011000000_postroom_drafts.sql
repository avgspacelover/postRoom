create table if not exists public.postroom_drafts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  draft jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.postroom_drafts enable row level security;

grant select, insert, update, delete on public.postroom_drafts to authenticated;

create policy "Users can read their own drafts"
  on public.postroom_drafts for select
  using (auth.uid() = user_id);

create policy "Users can create their own drafts"
  on public.postroom_drafts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own drafts"
  on public.postroom_drafts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own drafts"
  on public.postroom_drafts for delete
  using (auth.uid() = user_id);

-- Provider tokens and OAuth state are server-only. Edge Functions use the
-- service role; browser clients must never receive direct table privileges.
create table if not exists public.platform_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('x', 'instagram')),
  platform_user_id text not null,
  username text,
  token_data jsonb not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, platform)
);
alter table public.platform_connections enable row level security;
revoke all on public.platform_connections from anon, authenticated;

create table if not exists public.platform_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('x', 'instagram')),
  code_verifier text,
  expires_at timestamptz not null
);
alter table public.platform_oauth_states enable row level security;
revoke all on public.platform_oauth_states from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('postroom-media', 'postroom-media', true, 1572864, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- A global rolling 24-hour cap is required before X create-post calls are enabled.
create table if not exists public.platform_x_publish_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);
alter table public.platform_x_publish_events enable row level security;
revoke all on public.platform_x_publish_events from anon, authenticated;

create or replace function public.reserve_x_publish(p_daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  event_count integer;
begin
  if p_daily_limit is null or p_daily_limit < 1 then
    return false;
  end if;
  perform pg_advisory_xact_lock(78122416);
  select count(*) into event_count
    from public.platform_x_publish_events
    where created_at > now() - interval '24 hours';
  if event_count >= p_daily_limit then
    return false;
  end if;
  insert into public.platform_x_publish_events default values;
  return true;
end;
$$;
revoke all on function public.reserve_x_publish(integer) from public, anon, authenticated;
grant execute on function public.reserve_x_publish(integer) to service_role;
