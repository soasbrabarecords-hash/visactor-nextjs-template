-- Remove only exact duplicate participant lines before enforcing identity rules.
with ranked as (
  select id,
         row_number() over (
           partition by workspace_id, track_id, entity_id, lower(trim(role))
           order by created_at asc, id asc
         ) as duplicate_position
  from public.label_track_compositions
)
delete from public.label_track_compositions composition
using ranked
where composition.id = ranked.id
  and ranked.duplicate_position > 1;

with ranked as (
  select id,
         row_number() over (
           partition by workspace_id, track_id, entity_id, group_type,
                        lower(trim(coalesce(role, '')))
           order by created_at asc, id asc
         ) as duplicate_position
  from public.label_track_master_splits
)
delete from public.label_track_master_splits master_split
using ranked
where master_split.id = ranked.id
  and ranked.duplicate_position > 1;

with ranked as (
  select id,
         row_number() over (
           partition by workspace_id, track_id, entity_id,
                        lower(trim(coalesce(role, '')))
           order by created_at asc, id asc
         ) as duplicate_position
  from public.label_track_royalty_splits
)
delete from public.label_track_royalty_splits royalty_split
using ranked
where royalty_split.id = ranked.id
  and ranked.duplicate_position > 1;

create unique index if not exists label_track_compositions_identity_uidx
  on public.label_track_compositions (
    workspace_id,
    track_id,
    entity_id,
    lower(trim(role))
  );

create unique index if not exists label_track_master_splits_identity_uidx
  on public.label_track_master_splits (
    workspace_id,
    track_id,
    entity_id,
    group_type,
    lower(trim(coalesce(role, '')))
  );

create unique index if not exists label_track_royalty_splits_identity_uidx
  on public.label_track_royalty_splits (
    workspace_id,
    track_id,
    entity_id,
    lower(trim(coalesce(role, '')))
  );
