-- Keep API roles on the least-privilege surface required by the Label OS UI.
revoke all on public.label_track_readiness from public, anon, authenticated;
revoke all on public.label_track_tasks from public, anon, authenticated;

grant select, insert, update, delete on public.label_track_readiness to authenticated;
grant select, insert, update, delete on public.label_track_tasks to authenticated;

-- The unique (workspace_id, track_id) constraint already owns an equivalent index.
drop index if exists public.label_track_readiness_workspace_track_idx;

-- Cover auth.users foreign keys for account deletion and integrity checks.
create index if not exists label_track_readiness_created_by_idx
  on public.label_track_readiness (created_by)
  where created_by is not null;

create index if not exists label_track_tasks_created_by_idx
  on public.label_track_tasks (created_by)
  where created_by is not null;

