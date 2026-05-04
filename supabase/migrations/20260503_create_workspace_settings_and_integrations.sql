create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  default_market text not null default 'BR',
  release_window_days integer not null default 21,
  suggestion_score_threshold integer not null default 70,
  prioritize_followed_artists boolean not null default true,
  prioritize_top_tracks boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  app_mode text not null default 'global_app' check (app_mode in ('global_app', 'workspace_app')),
  connection_status text not null default 'not_connected' check (connection_status in ('not_connected', 'connected', 'error')),
  app_client_id text,
  app_client_secret text,
  provider_account_id text,
  provider_account_label text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  granted_scopes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index if not exists workspaces_owner_user_idx
  on public.workspaces (owner_user_id);

create index if not exists workspace_memberships_user_idx
  on public.workspace_memberships (user_id, created_at desc);

create index if not exists workspace_integrations_workspace_provider_idx
  on public.workspace_integrations (workspace_id, provider);

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.workspace_integrations enable row level security;

create policy "workspace members can read workspaces"
  on public.workspaces
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspaces.id
        and memberships.user_id = auth.uid()
    )
  );

create policy "authenticated users can create owned workspaces"
  on public.workspaces
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "workspace owners and admins can update workspaces"
  on public.workspaces
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspaces.id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspaces.id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "workspace members can read memberships"
  on public.workspace_memberships
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_memberships.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "users can create their own membership rows"
  on public.workspace_memberships
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "workspace owners and admins can manage memberships"
  on public.workspace_memberships
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_memberships.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_memberships.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "workspace owners and admins can delete memberships"
  on public.workspace_memberships
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_memberships.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "workspace members can read settings"
  on public.workspace_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_settings.workspace_id
        and memberships.user_id = auth.uid()
    )
  );

create policy "workspace owners and admins can insert settings"
  on public.workspace_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_settings.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "workspace owners and admins can update settings"
  on public.workspace_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_settings.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_settings.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "workspace members can read integrations"
  on public.workspace_integrations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_integrations.workspace_id
        and memberships.user_id = auth.uid()
    )
  );

create policy "workspace owners and admins can insert integrations"
  on public.workspace_integrations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_integrations.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "workspace owners and admins can update integrations"
  on public.workspace_integrations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_integrations.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_integrations.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );
