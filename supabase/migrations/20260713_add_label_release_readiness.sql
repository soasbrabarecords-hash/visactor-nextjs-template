-- Release Readiness is derived from the existing Label OS catalog data.
-- These tables only persist manual operational confirmations and tasks.

alter table public.label_entities
  add column if not exists ipi_cae text,
  add column if not exists rights_society text,
  add column if not exists publisher_name text,
  add column if not exists payment_data_complete boolean not null default false;

create table if not exists public.label_track_readiness (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  track_id uuid not null,
  work_registered boolean not null default false,
  work_registration_society text,
  work_registration_proof_attached boolean not null default false,
  p_line text,
  c_line text,
  master_owner text,
  wav_approved boolean not null default false,
  cover_approved boolean not null default false,
  distributor text,
  label_commission_percentage numeric(5,2),
  payment_data_confirmed boolean not null default false,
  contracts_approved boolean not null default false,
  featured_contract_approved boolean not null default false,
  payment_rule text,
  symphonic_release_created boolean not null default false,
  delivered_to_stores boolean not null default false,
  published boolean not null default false,
  responsible text,
  priority text not null default 'medium',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint label_track_readiness_workspace_track_unique unique (workspace_id, track_id),
  constraint label_track_readiness_track_workspace_fkey
    foreign key (track_id, workspace_id)
    references public.label_tracks(id, workspace_id)
    on delete cascade,
  constraint label_track_readiness_commission_check
    check (
      label_commission_percentage is null
      or (label_commission_percentage >= 0 and label_commission_percentage <= 100)
    ),
  constraint label_track_readiness_priority_check
    check (priority in ('low', 'medium', 'high', 'urgent'))
);

create table if not exists public.label_track_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  track_id uuid not null,
  area text not null,
  title text not null,
  responsible text,
  priority text not null default 'medium',
  status text not null default 'todo',
  due_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint label_track_tasks_track_workspace_fkey
    foreign key (track_id, workspace_id)
    references public.label_tracks(id, workspace_id)
    on delete cascade,
  constraint label_track_tasks_area_check
    check (area in ('track', 'work', 'master', 'royalties', 'contracts', 'distribution', 'files')),
  constraint label_track_tasks_priority_check
    check (priority in ('low', 'medium', 'high', 'urgent')),
  constraint label_track_tasks_status_check
    check (status in ('todo', 'in_progress', 'done'))
);

create index if not exists label_track_readiness_workspace_track_idx
  on public.label_track_readiness (workspace_id, track_id);

create index if not exists label_track_tasks_workspace_track_status_idx
  on public.label_track_tasks (workspace_id, track_id, status);

create index if not exists label_track_tasks_workspace_status_priority_idx
  on public.label_track_tasks (workspace_id, status, priority);

create or replace function private.label_readiness_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.label_readiness_touch_updated_at() from public, anon, authenticated;

drop trigger if exists label_track_readiness_touch_updated_at on public.label_track_readiness;
create trigger label_track_readiness_touch_updated_at
  before update on public.label_track_readiness
  for each row execute function private.label_readiness_touch_updated_at();

drop trigger if exists label_track_tasks_touch_updated_at on public.label_track_tasks;
create trigger label_track_tasks_touch_updated_at
  before update on public.label_track_tasks
  for each row execute function private.label_readiness_touch_updated_at();

alter table public.label_track_readiness enable row level security;
alter table public.label_track_tasks enable row level security;

drop policy if exists label_track_readiness_workspace_select on public.label_track_readiness;
drop policy if exists label_track_readiness_workspace_insert on public.label_track_readiness;
drop policy if exists label_track_readiness_workspace_update on public.label_track_readiness;
drop policy if exists label_track_readiness_workspace_delete on public.label_track_readiness;

create policy label_track_readiness_workspace_select
  on public.label_track_readiness for select to authenticated
  using ((select private.label_current_user_has_workspace_access(workspace_id)));

create policy label_track_readiness_workspace_insert
  on public.label_track_readiness for insert to authenticated
  with check ((select private.label_current_user_has_workspace_access(workspace_id)));

create policy label_track_readiness_workspace_update
  on public.label_track_readiness for update to authenticated
  using ((select private.label_current_user_has_workspace_access(workspace_id)))
  with check ((select private.label_current_user_has_workspace_access(workspace_id)));

create policy label_track_readiness_workspace_delete
  on public.label_track_readiness for delete to authenticated
  using ((select private.label_current_user_has_workspace_access(workspace_id)));

drop policy if exists label_track_tasks_workspace_select on public.label_track_tasks;
drop policy if exists label_track_tasks_workspace_insert on public.label_track_tasks;
drop policy if exists label_track_tasks_workspace_update on public.label_track_tasks;
drop policy if exists label_track_tasks_workspace_delete on public.label_track_tasks;

create policy label_track_tasks_workspace_select
  on public.label_track_tasks for select to authenticated
  using ((select private.label_current_user_has_workspace_access(workspace_id)));

create policy label_track_tasks_workspace_insert
  on public.label_track_tasks for insert to authenticated
  with check ((select private.label_current_user_has_workspace_access(workspace_id)));

create policy label_track_tasks_workspace_update
  on public.label_track_tasks for update to authenticated
  using ((select private.label_current_user_has_workspace_access(workspace_id)))
  with check ((select private.label_current_user_has_workspace_access(workspace_id)));

create policy label_track_tasks_workspace_delete
  on public.label_track_tasks for delete to authenticated
  using ((select private.label_current_user_has_workspace_access(workspace_id)));

revoke all on public.label_track_readiness from anon;
revoke all on public.label_track_tasks from anon;
grant select, insert, update, delete on public.label_track_readiness to authenticated;
grant select, insert, update, delete on public.label_track_tasks to authenticated;

