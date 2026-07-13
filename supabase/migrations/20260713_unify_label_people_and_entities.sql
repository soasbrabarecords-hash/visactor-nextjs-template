-- label_entities becomes the single source of truth for every catalog participant.
alter table public.label_entities
  add column if not exists entity_kind text,
  add column if not exists spotify_artist_id text,
  add column if not exists pix_key text,
  add column if not exists bank_details text,
  add column if not exists publisher_entity_id uuid,
  add column if not exists legacy_artist_id uuid;

update public.label_entities
set entity_kind = case
  when type in ('artist', 'producer', 'composer') then 'person'
  else 'company'
end
where entity_kind is null;

alter table public.label_entities
  alter column entity_kind set default 'person',
  alter column entity_kind set not null;

alter table public.label_entities
  drop constraint if exists label_entities_entity_kind_check;
alter table public.label_entities
  add constraint label_entities_entity_kind_check
  check (entity_kind in ('person', 'company'));

-- Convert the old category and role model into a unified multi-function catalog.
update public.label_entities
set roles = array(
  select distinct role
  from unnest(
    coalesce(roles, '{}'::text[]) ||
    case type
      when 'artist' then array['artist']
      when 'producer' then array['music_producer']
      when 'composer' then array['composer']
      when 'label' then array['record_company']
      when 'imprint' then array['label']
      when 'publisher' then array['publisher']
      when 'manager' then array['manager']
      when 'company' then array['company']
      else '{}'::text[]
    end
  ) as role
);

-- Link every legacy artist to its existing entity using document first, then legal name.
with artist_mapping as (
  select
    artist.id as artist_id,
    coalesce(
      (
        select entity.id
        from public.label_entities entity
        where entity.workspace_id = artist.workspace_id
          and nullif(trim(artist.document), '') is not null
          and lower(trim(entity.document)) = lower(trim(artist.document))
        order by entity.created_at asc
        limit 1
      ),
      (
        select entity.id
        from public.label_entities entity
        where entity.workspace_id = artist.workspace_id
          and lower(trim(entity.name)) = lower(trim(artist.name))
        order by entity.created_at asc
        limit 1
      )
    ) as entity_id
  from public.label_artists artist
)
update public.label_entities entity
set
  legacy_artist_id = mapping.artist_id,
  display_name = coalesce(entity.display_name, artist.artist_name),
  email = coalesce(entity.email, artist.email),
  phone = coalesce(entity.phone, artist.phone),
  instagram = coalesce(entity.instagram, artist.instagram),
  spotify_url = coalesce(entity.spotify_url, artist.spotify_url),
  apple_music_url = coalesce(entity.apple_music_url, artist.apple_music_url),
  youtube_url = coalesce(entity.youtube_url, artist.youtube_url),
  document = coalesce(entity.document, artist.document),
  birth_date = coalesce(entity.birth_date, artist.birth_date),
  notes = coalesce(entity.notes, artist.notes),
  entity_kind = 'person',
  roles = array(
    select distinct role
    from unnest(
      coalesce(entity.roles, '{}'::text[]) ||
      coalesce(artist.roles, '{}'::text[]) ||
      array['artist']
    ) as role
  )
from artist_mapping mapping
join public.label_artists artist on artist.id = mapping.artist_id
where entity.id = mapping.entity_id;

-- Preserve artists created after the first historical import.
insert into public.label_entities (
  workspace_id,
  name,
  display_name,
  type,
  entity_kind,
  roles,
  email,
  phone,
  instagram,
  spotify_url,
  apple_music_url,
  youtube_url,
  document,
  birth_date,
  notes,
  created_at,
  legacy_artist_id
)
select
  artist.workspace_id,
  artist.name,
  artist.artist_name,
  'artist',
  'person',
  array(
    select distinct role
    from unnest(coalesce(artist.roles, '{}'::text[]) || array['artist']) as role
  ),
  artist.email,
  artist.phone,
  artist.instagram,
  artist.spotify_url,
  artist.apple_music_url,
  artist.youtube_url,
  artist.document,
  artist.birth_date,
  artist.notes,
  artist.created_at,
  artist.id
from public.label_artists artist
where not exists (
  select 1
  from public.label_entities entity
  where entity.workspace_id = artist.workspace_id
    and entity.legacy_artist_id = artist.id
);

-- The CP no Beat catalog record was supplied with these explicit functions.
update public.label_entities
set roles = array(
  select distinct role
  from unnest(
    roles || array['artist', 'interpreter', 'composer', 'music_producer']
  ) as role
)
where lower(trim(name)) = 'adriano colombo pires'
  and lower(trim(coalesce(display_name, ''))) = 'cp no beat';

-- Move every track participant to the unified entity reference.
update public.label_track_participants participant
set entity_id = entity.id
from public.label_entities entity
where participant.artist_id is not null
  and entity.workspace_id = participant.workspace_id
  and entity.legacy_artist_id = participant.artist_id
  and participant.entity_id is null;

update public.label_track_participants
set artist_id = null
where entity_id is not null and artist_id is not null;

alter table public.label_entities
  drop constraint if exists label_entities_publisher_workspace_fkey;
alter table public.label_entities
  add constraint label_entities_publisher_workspace_fkey
  foreign key (publisher_entity_id, workspace_id)
  references public.label_entities(id, workspace_id)
  on delete restrict;

create unique index if not exists label_entities_workspace_legacy_artist_uidx
  on public.label_entities (workspace_id, legacy_artist_id)
  where legacy_artist_id is not null;

create unique index if not exists label_entities_workspace_document_uidx
  on public.label_entities (workspace_id, lower(trim(document)))
  where nullif(trim(document), '') is not null;

create unique index if not exists label_entities_workspace_identity_uidx
  on public.label_entities (
    workspace_id,
    lower(trim(name)),
    lower(trim(coalesce(display_name, '')))
  );

create index if not exists label_entities_workspace_kind_name_idx
  on public.label_entities (workspace_id, entity_kind, name);

create index if not exists label_entities_roles_gin_idx
  on public.label_entities using gin (roles);

create index if not exists label_entities_publisher_workspace_idx
  on public.label_entities (publisher_entity_id, workspace_id)
  where publisher_entity_id is not null;

-- label_artists remains only as a read-only legacy archive during the transition.
drop policy if exists label_artists_workspace_insert on public.label_artists;
drop policy if exists label_artists_workspace_update on public.label_artists;
drop policy if exists label_artists_workspace_delete on public.label_artists;

revoke insert, update, delete on public.label_artists from authenticated;
grant select on public.label_artists to authenticated;
