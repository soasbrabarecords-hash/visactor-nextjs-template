create extension if not exists pgcrypto;

alter table public.workspaces
  add column if not exists type text,
  add column if not exists status text not null default 'active';

alter table public.workspaces
  alter column owner_user_id drop not null;

update public.workspaces
set status = 'active'
where status is null;

create table if not exists public.workspace_users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive', 'pending', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.workspace_modules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  module_key text not null check (module_key in ('playlist_os', 'label_os', 'artist_os')),
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, module_key)
);

create table if not exists public.module_roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null check (module_key in ('playlist_os', 'label_os', 'artist_os')),
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, module_key),
  check (
    (module_key = 'artist_os' and role in ('admin', 'manager', 'financeiro', 'artista', 'equipe', 'viewer'))
    or (module_key = 'playlist_os' and role in ('admin', 'curador', 'analista', 'cliente', 'viewer'))
    or (module_key = 'label_os' and role in ('admin', 'label_manager', 'financeiro', 'juridico', 'artista', 'viewer'))
  )
);

create index if not exists workspace_users_user_idx
  on public.workspace_users (user_id, status, created_at);

create index if not exists workspace_users_workspace_idx
  on public.workspace_users (workspace_id, status);

create index if not exists workspace_modules_workspace_idx
  on public.workspace_modules (workspace_id, is_enabled);

create index if not exists module_roles_user_workspace_idx
  on public.module_roles (user_id, workspace_id, module_key);

create or replace function public.workspace_access_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspace_users_touch_updated_at on public.workspace_users;
create trigger workspace_users_touch_updated_at
  before update on public.workspace_users
  for each row execute function public.workspace_access_touch_updated_at();

drop trigger if exists workspace_modules_touch_updated_at on public.workspace_modules;
create trigger workspace_modules_touch_updated_at
  before update on public.workspace_modules
  for each row execute function public.workspace_access_touch_updated_at();

drop trigger if exists module_roles_touch_updated_at on public.module_roles;
create trigger module_roles_touch_updated_at
  before update on public.module_roles
  for each row execute function public.workspace_access_touch_updated_at();

alter table public.workspace_users enable row level security;
alter table public.workspace_modules enable row level security;
alter table public.module_roles enable row level security;

create policy "users can read their workspace access"
  on public.workspace_users
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_users.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "workspace owners can manage users"
  on public.workspace_users
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_users.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_users.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "workspace users can read enabled modules"
  on public.workspace_modules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_users users
      where users.workspace_id = workspace_modules.workspace_id
        and users.user_id = auth.uid()
        and users.status = 'active'
    )
    or exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_modules.workspace_id
        and memberships.user_id = auth.uid()
    )
  );

create policy "workspace owners can manage modules"
  on public.workspace_modules
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_users users
      where users.workspace_id = workspace_modules.workspace_id
        and users.user_id = auth.uid()
        and users.status = 'active'
        and users.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_modules.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_users users
      where users.workspace_id = workspace_modules.workspace_id
        and users.user_id = auth.uid()
        and users.status = 'active'
        and users.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = workspace_modules.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "users can read their module roles"
  on public.module_roles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.workspace_users users
      where users.workspace_id = module_roles.workspace_id
        and users.user_id = auth.uid()
        and users.status = 'active'
        and users.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = module_roles.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "workspace owners can manage module roles"
  on public.module_roles
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_users users
      where users.workspace_id = module_roles.workspace_id
        and users.user_id = auth.uid()
        and users.status = 'active'
        and users.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = module_roles.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_users users
      where users.workspace_id = module_roles.workspace_id
        and users.user_id = auth.uid()
        and users.status = 'active'
        and users.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.workspace_memberships memberships
      where memberships.workspace_id = module_roles.workspace_id
        and memberships.user_id = auth.uid()
        and memberships.role in ('owner', 'admin')
    )
  );

create policy "workspace users can read workspace records"
  on public.workspaces
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_users users
      where users.workspace_id = workspaces.id
        and users.user_id = auth.uid()
        and users.status = 'active'
    )
  );

create policy "workspace users can read settings records"
  on public.workspace_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_users users
      where users.workspace_id = workspace_settings.workspace_id
        and users.user_id = auth.uid()
        and users.status = 'active'
    )
  );

create policy "workspace users can read integration records"
  on public.workspace_integrations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_users users
      where users.workspace_id = workspace_integrations.workspace_id
        and users.user_id = auth.uid()
        and users.status = 'active'
    )
  );

insert into public.workspace_users (workspace_id, user_id, role, status, created_at, updated_at)
select
  memberships.workspace_id,
  memberships.user_id,
  case
    when memberships.role in ('owner', 'admin', 'viewer') then memberships.role
    else 'member'
  end,
  'active',
  memberships.created_at,
  now()
from public.workspace_memberships memberships
on conflict (workspace_id, user_id) do update
set role = excluded.role,
    status = 'active',
    updated_at = now();

insert into public.workspace_users (workspace_id, user_id, role, status)
select workspaces.id, workspaces.owner_user_id, 'owner', 'active'
from public.workspaces workspaces
where workspaces.owner_user_id is not null
on conflict (workspace_id, user_id) do update
set role = 'owner',
    status = 'active',
    updated_at = now();

insert into public.workspaces (name, slug, type, status, owner_user_id)
values (
  'SÓ AS BRABA Records',
  'so-as-braba-records',
  'internal',
  'active',
  (select users.id from auth.users users order by users.created_at asc limit 1)
)
on conflict (slug) do update
set name = excluded.name,
    type = excluded.type,
    status = excluded.status,
    updated_at = now();

insert into public.workspace_users (workspace_id, user_id, role, status)
select workspaces.id, users.id, 'owner', 'active'
from public.workspaces workspaces
cross join lateral (
  select auth_users.id
  from auth.users auth_users
  order by auth_users.created_at asc
  limit 1
) users
where workspaces.slug = 'so-as-braba-records'
on conflict (workspace_id, user_id) do update
set role = 'owner',
    status = 'active',
    updated_at = now();

insert into public.workspace_memberships (workspace_id, user_id, role)
select workspaces.id, users.id, 'owner'
from public.workspaces workspaces
cross join lateral (
  select auth_users.id
  from auth.users auth_users
  order by auth_users.created_at asc
  limit 1
) users
where workspaces.slug = 'so-as-braba-records'
on conflict (workspace_id, user_id) do update
set role = 'owner';

insert into public.workspace_settings (workspace_id)
select workspaces.id
from public.workspaces workspaces
on conflict (workspace_id) do nothing;

insert into public.workspace_integrations (workspace_id, provider, app_mode, connection_status)
select workspaces.id, providers.provider, 'global_app', 'not_connected'
from public.workspaces workspaces
cross join (
  values ('spotify'), ('openai')
) as providers(provider)
on conflict (workspace_id, provider) do nothing;

insert into public.workspace_modules (workspace_id, module_key, is_enabled)
select workspaces.id, modules.module_key, true
from public.workspaces workspaces
cross join (
  values ('playlist_os'), ('label_os'), ('artist_os')
) as modules(module_key)
on conflict (workspace_id, module_key) do update
set is_enabled = true,
    updated_at = now();

insert into public.module_roles (workspace_id, user_id, module_key, role)
select
  users.workspace_id,
  users.user_id,
  modules.module_key,
  case
    when users.role in ('owner', 'admin') then 'admin'
    else 'viewer'
  end
from public.workspace_users users
cross join (
  values ('playlist_os'), ('label_os'), ('artist_os')
) as modules(module_key)
where users.status = 'active'
on conflict (workspace_id, user_id, module_key) do update
set role = excluded.role,
    updated_at = now();
