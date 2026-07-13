-- Promote historical composer shares into the professional Obra table.
-- Keep the original participant rows for backwards compatibility/readiness fallback.
insert into public.label_track_compositions (
  workspace_id,
  track_id,
  entity_id,
  role,
  percentage,
  created_at
)
select
  participant.workspace_id,
  participant.track_id,
  participant.entity_id,
  'compositor',
  participant.publishing_percentage,
  participant.created_at
from public.label_track_participants participant
where participant.entity_id is not null
  and participant.publishing_percentage > 0
  and not exists (
    select 1
    from public.label_track_compositions composition
    where composition.workspace_id = participant.workspace_id
      and composition.track_id = participant.track_id
      and composition.entity_id = participant.entity_id
  )
on conflict do nothing;
