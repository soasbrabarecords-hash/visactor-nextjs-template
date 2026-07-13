-- Cover composite track foreign keys in their declared column order.
create index if not exists label_track_readiness_track_workspace_idx
  on public.label_track_readiness (track_id, workspace_id);

create index if not exists label_track_tasks_track_workspace_idx
  on public.label_track_tasks (track_id, workspace_id);

