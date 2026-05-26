create extension if not exists pgcrypto;

create table if not exists public.playlist_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  action_type text not null,
  spotify_playlist_id text not null,
  spotify_track_id text not null,
  chart_snapshot_track_id uuid,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists playlist_actions_workspace_created_idx
  on public.playlist_actions (workspace_id, created_at desc);

create index if not exists playlist_actions_user_created_idx
  on public.playlist_actions (user_id, created_at desc);

create index if not exists playlist_actions_playlist_idx
  on public.playlist_actions (spotify_playlist_id, created_at desc);

do $$
declare
  default_workspace_id uuid;
  access_admin_user_id uuid := 'a4456937-e1af-4e32-91ba-32d66f1f661b'::uuid;
begin
  select id
    into default_workspace_id
    from public.workspaces
   where slug = 'so-as-braba-records'
   limit 1;

  if default_workspace_id is null then
    return;
  end if;

  update public.artist_os_artists
     set workspace_id = default_workspace_id
   where workspace_id is null;

  update public.artist_os_shows
     set workspace_id = default_workspace_id
   where workspace_id is null;

  update public.artist_os_deals
     set workspace_id = default_workspace_id
   where workspace_id is null;

  update public.artist_os_brand_deals
     set workspace_id = default_workspace_id
   where workspace_id is null;

  update public.artist_os_brand_deliverables
     set workspace_id = default_workspace_id
   where workspace_id is null;

  update public.artist_os_finance
     set workspace_id = default_workspace_id
   where workspace_id is null;

  update public.artist_os_contracts
     set workspace_id = default_workspace_id
   where workspace_id is null;

  update public.artist_os_tasks
     set workspace_id = default_workspace_id
   where workspace_id is null;

  update public.artist_os_files
     set workspace_id = default_workspace_id
   where workspace_id is null;

  if not exists (
    select 1
      from public.artist_os_settings
     where workspace_id = default_workspace_id
  ) then
    update public.artist_os_settings
       set workspace_id = default_workspace_id
     where id = (
       select id
         from public.artist_os_settings
        where workspace_id is null
        order by created_at asc
        limit 1
     );
  end if;

  delete from public.artist_os_settings
   where workspace_id is null;

  if exists (select 1 from auth.users where id = access_admin_user_id) then
    insert into public.workspace_users (
      workspace_id,
      user_id,
      role,
      status
    )
    values (
      default_workspace_id,
      access_admin_user_id,
      'owner',
      'active'
    )
    on conflict (workspace_id, user_id)
    do update set
      role = 'owner',
      status = 'active',
      updated_at = now();

    insert into public.workspace_memberships (
      workspace_id,
      user_id,
      role
    )
    values (
      default_workspace_id,
      access_admin_user_id,
      'owner'
    )
    on conflict (workspace_id, user_id)
    do update set role = 'owner';

    insert into public.workspace_modules (
      workspace_id,
      module_key,
      is_enabled
    )
    values
      (default_workspace_id, 'playlist_os', true),
      (default_workspace_id, 'label_os', true),
      (default_workspace_id, 'artist_os', true)
    on conflict (workspace_id, module_key)
    do update set
      is_enabled = excluded.is_enabled,
      updated_at = now();

    insert into public.module_roles (
      workspace_id,
      user_id,
      module_key,
      role
    )
    values
      (default_workspace_id, access_admin_user_id, 'playlist_os', 'admin'),
      (default_workspace_id, access_admin_user_id, 'label_os', 'admin'),
      (default_workspace_id, access_admin_user_id, 'artist_os', 'admin')
    on conflict (workspace_id, user_id, module_key)
    do update set
      role = excluded.role,
      updated_at = now();
  end if;
end $$;
