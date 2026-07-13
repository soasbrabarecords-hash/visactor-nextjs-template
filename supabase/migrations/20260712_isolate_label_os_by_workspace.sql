-- Label OS: tenant isolation for every catalog record and uploaded asset.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.label_track_compositions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  track_id uuid references public.label_tracks(id) on delete cascade,
  entity_id uuid references public.label_entities(id) on delete cascade,
  role text default 'composer',
  percentage numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.label_track_master_splits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  track_id uuid references public.label_tracks(id) on delete cascade,
  entity_id uuid references public.label_entities(id) on delete cascade,
  group_type text not null,
  role text,
  percentage numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.label_track_royalty_splits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  track_id uuid references public.label_tracks(id) on delete cascade,
  entity_id uuid references public.label_entities(id) on delete cascade,
  role text,
  percentage numeric default 0,
  recoupable boolean default false,
  notes text,
  created_at timestamptz default now()
);

alter table public.label_artists add column if not exists workspace_id uuid;
alter table public.label_tracks add column if not exists workspace_id uuid;
alter table public.label_entities add column if not exists workspace_id uuid;
alter table public.label_track_participants add column if not exists workspace_id uuid;
alter table public.label_track_compositions add column if not exists workspace_id uuid;
alter table public.label_track_master_splits add column if not exists workspace_id uuid;
alter table public.label_track_royalty_splits add column if not exists workspace_id uuid;

do $$
declare
  legacy_workspace_id uuid;
begin
  select wu.workspace_id
    into legacy_workspace_id
  from public.workspace_users wu
  join auth.users u on u.id = wu.user_id
  join public.workspaces w on w.id = wu.workspace_id
  where lower(u.email) = 'contato@soasbraba.com'
    and wu.status = 'active'
    and w.status = 'active'
  order by wu.created_at asc
  limit 1;

  if legacy_workspace_id is null then
    select w.id
      into legacy_workspace_id
    from public.workspaces w
    where w.status = 'active'
    order by w.created_at asc
    limit 1;
  end if;

  if legacy_workspace_id is null then
    raise exception 'Label OS isolation requires at least one active workspace';
  end if;

  update public.label_artists
  set workspace_id = legacy_workspace_id
  where workspace_id is null;

  update public.label_tracks
  set workspace_id = legacy_workspace_id
  where workspace_id is null;

  update public.label_entities
  set workspace_id = legacy_workspace_id
  where workspace_id is null;

  update public.label_track_participants p
  set workspace_id = coalesce(t.workspace_id, legacy_workspace_id)
  from public.label_tracks t
  where p.track_id = t.id
    and p.workspace_id is null;

  update public.label_track_participants
  set workspace_id = legacy_workspace_id
  where workspace_id is null;

  update public.label_track_compositions s
  set workspace_id = coalesce(t.workspace_id, legacy_workspace_id)
  from public.label_tracks t
  where s.track_id = t.id
    and s.workspace_id is null;

  update public.label_track_master_splits s
  set workspace_id = coalesce(t.workspace_id, legacy_workspace_id)
  from public.label_tracks t
  where s.track_id = t.id
    and s.workspace_id is null;

  update public.label_track_royalty_splits s
  set workspace_id = coalesce(t.workspace_id, legacy_workspace_id)
  from public.label_tracks t
  where s.track_id = t.id
    and s.workspace_id is null;

  update public.label_track_compositions set workspace_id = legacy_workspace_id where workspace_id is null;
  update public.label_track_master_splits set workspace_id = legacy_workspace_id where workspace_id is null;
  update public.label_track_royalty_splits set workspace_id = legacy_workspace_id where workspace_id is null;
end
$$;

alter table public.label_artists alter column workspace_id set not null;
alter table public.label_tracks alter column workspace_id set not null;
alter table public.label_entities alter column workspace_id set not null;
alter table public.label_track_participants alter column workspace_id set not null;
alter table public.label_track_compositions alter column workspace_id set not null;
alter table public.label_track_master_splits alter column workspace_id set not null;
alter table public.label_track_royalty_splits alter column workspace_id set not null;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'label_artists',
    'label_tracks',
    'label_entities',
    'label_track_participants',
    'label_track_compositions',
    'label_track_master_splits',
    'label_track_royalty_splits'
  ] loop
    if not exists (
      select 1 from pg_constraint
      where conname = table_name || '_workspace_id_fkey'
        and conrelid = format('public.%I', table_name)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (workspace_id) references public.workspaces(id) on delete cascade',
        table_name,
        table_name || '_workspace_id_fkey'
      );
    end if;
  end loop;
end
$$;

create unique index if not exists label_artists_id_workspace_uidx
  on public.label_artists (id, workspace_id);
create unique index if not exists label_tracks_id_workspace_uidx
  on public.label_tracks (id, workspace_id);
create unique index if not exists label_entities_id_workspace_uidx
  on public.label_entities (id, workspace_id);

create index if not exists label_artists_workspace_created_idx
  on public.label_artists (workspace_id, created_at desc);
create index if not exists label_tracks_workspace_created_idx
  on public.label_tracks (workspace_id, created_at desc);
create index if not exists label_tracks_workspace_status_created_idx
  on public.label_tracks (workspace_id, status, created_at desc);
create index if not exists label_entities_workspace_name_idx
  on public.label_entities (workspace_id, name);
create index if not exists label_track_participants_workspace_track_idx
  on public.label_track_participants (workspace_id, track_id, created_at);
create index if not exists label_track_compositions_workspace_track_idx
  on public.label_track_compositions (workspace_id, track_id, created_at);
create index if not exists label_track_master_splits_workspace_track_idx
  on public.label_track_master_splits (workspace_id, track_id, created_at);
create index if not exists label_track_royalty_splits_workspace_track_idx
  on public.label_track_royalty_splits (workspace_id, track_id, created_at);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'label_participants_track_workspace_fkey') then
    alter table public.label_track_participants
      add constraint label_participants_track_workspace_fkey
      foreign key (track_id, workspace_id)
      references public.label_tracks(id, workspace_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'label_participants_artist_workspace_fkey') then
    alter table public.label_track_participants
      add constraint label_participants_artist_workspace_fkey
      foreign key (artist_id, workspace_id)
      references public.label_artists(id, workspace_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'label_participants_entity_workspace_fkey') then
    alter table public.label_track_participants
      add constraint label_participants_entity_workspace_fkey
      foreign key (entity_id, workspace_id)
      references public.label_entities(id, workspace_id)
      on delete cascade;
  end if;
end
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'label_track_compositions',
    'label_track_master_splits',
    'label_track_royalty_splits'
  ] loop
    if not exists (select 1 from pg_constraint where conname = table_name || '_track_workspace_fkey') then
      execute format(
        'alter table public.%I add constraint %I foreign key (track_id, workspace_id) references public.label_tracks(id, workspace_id) on delete cascade',
        table_name,
        table_name || '_track_workspace_fkey'
      );
    end if;

    if not exists (select 1 from pg_constraint where conname = table_name || '_entity_workspace_fkey') then
      execute format(
        'alter table public.%I add constraint %I foreign key (entity_id, workspace_id) references public.label_entities(id, workspace_id) on delete cascade',
        table_name,
        table_name || '_entity_workspace_fkey'
      );
    end if;
  end loop;
end
$$;

create or replace function private.label_current_user_has_workspace_access(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_users wu
    join public.workspaces w on w.id = wu.workspace_id
    where wu.workspace_id = target_workspace_id
      and wu.user_id = (select auth.uid())
      and wu.status = 'active'
      and w.status = 'active'
  ) or exists (
    select 1
    from public.workspace_memberships wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and w.status = 'active'
  );
$$;

revoke all on function private.label_current_user_has_workspace_access(uuid) from public, anon;
grant execute on function private.label_current_user_has_workspace_access(uuid) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'label_artists',
    'label_tracks',
    'label_entities',
    'label_track_participants',
    'label_track_compositions',
    'label_track_master_splits',
    'label_track_royalty_splits'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists "authenticated full access" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can read label artists" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can insert label artists" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can update label artists" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can delete label artists" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can read label tracks" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can insert label tracks" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can update label tracks" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can delete label tracks" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can read label entities" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can insert label entities" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can update label entities" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can delete label entities" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can read label track participants" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can insert label track participants" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can update label track participants" on public.%I', table_name);
    execute format('drop policy if exists "authenticated can delete label track participants" on public.%I', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_delete', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.label_current_user_has_workspace_access(workspace_id)))',
      table_name || '_workspace_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.label_current_user_has_workspace_access(workspace_id)))',
      table_name || '_workspace_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.label_current_user_has_workspace_access(workspace_id))) with check ((select private.label_current_user_has_workspace_access(workspace_id)))',
      table_name || '_workspace_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.label_current_user_has_workspace_access(workspace_id)))',
      table_name || '_workspace_delete', table_name
    );

    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end
$$;

create or replace function private.label_storage_workspace_id(object_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 1)::uuid
    else (
      select wu.workspace_id
      from public.workspace_users wu
      join auth.users u on u.id = wu.user_id
      join public.workspaces w on w.id = wu.workspace_id
      where lower(u.email) = 'contato@soasbraba.com'
        and wu.status = 'active'
        and w.status = 'active'
      order by wu.created_at asc
      limit 1
    )
  end;
$$;

revoke all on function private.label_storage_workspace_id(text) from public, anon;
grant execute on function private.label_storage_workspace_id(text) to authenticated;

drop policy if exists "label os upload files" on storage.objects;
drop policy if exists "label os update files" on storage.objects;
drop policy if exists "label os delete files" on storage.objects;
drop policy if exists "label os read private files" on storage.objects;
drop policy if exists "label os read public covers" on storage.objects;

create policy "label os upload files"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('label-covers', 'label-audio', 'label-contracts')
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (select private.label_current_user_has_workspace_access(private.label_storage_workspace_id(name)))
);

create policy "label os update files"
on storage.objects for update to authenticated
using (
  bucket_id in ('label-covers', 'label-audio', 'label-contracts')
  and (select private.label_current_user_has_workspace_access(private.label_storage_workspace_id(name)))
)
with check (
  bucket_id in ('label-covers', 'label-audio', 'label-contracts')
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (select private.label_current_user_has_workspace_access(private.label_storage_workspace_id(name)))
);

create policy "label os delete files"
on storage.objects for delete to authenticated
using (
  bucket_id in ('label-covers', 'label-audio', 'label-contracts')
  and (select private.label_current_user_has_workspace_access(private.label_storage_workspace_id(name)))
);

create policy "label os read private files"
on storage.objects for select to authenticated
using (
  bucket_id in ('label-audio', 'label-contracts')
  and (select private.label_current_user_has_workspace_access(private.label_storage_workspace_id(name)))
);
