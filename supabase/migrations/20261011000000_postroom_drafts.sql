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
