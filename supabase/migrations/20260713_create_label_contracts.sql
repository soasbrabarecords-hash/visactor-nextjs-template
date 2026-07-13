-- Contracts are immutable snapshots generated from the existing Label OS data.
create table if not exists public.label_contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  track_id uuid not null,
  contract_number text not null,
  title text not null,
  contract_type text not null default 'authorization_release_royalties',
  status text not null default 'generated',
  snapshot jsonb not null,
  pdf_path text not null,
  signed_pdf_path text,
  signed_file_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  signed_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint label_contracts_workspace_number_unique unique (workspace_id, contract_number),
  constraint label_contracts_track_workspace_fkey
    foreign key (track_id, workspace_id)
    references public.label_tracks(id, workspace_id)
    on delete restrict,
  constraint label_contracts_type_check check (
    contract_type in (
      'authorization_release_royalties',
      'artistic_participation_release',
      'master_release',
      'royalties_split',
      'distribution_authorization',
      'label_artist',
      'publishing_authoral'
    )
  ),
  constraint label_contracts_status_check check (
    status in ('draft', 'generated', 'sent', 'signed', 'expired', 'cancelled')
  ),
  constraint label_contracts_snapshot_object_check
    check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists label_contracts_workspace_status_created_idx
  on public.label_contracts (workspace_id, status, created_at desc);

create index if not exists label_contracts_workspace_track_created_idx
  on public.label_contracts (workspace_id, track_id, created_at desc);

create index if not exists label_contracts_track_workspace_idx
  on public.label_contracts (track_id, workspace_id);

create index if not exists label_contracts_created_by_idx
  on public.label_contracts (created_by)
  where created_by is not null;

create or replace function private.label_contract_preserve_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.workspace_id is distinct from new.workspace_id
    or old.track_id is distinct from new.track_id
    or old.contract_number is distinct from new.contract_number
    or old.contract_type is distinct from new.contract_type
    or old.snapshot is distinct from new.snapshot
    or old.pdf_path is distinct from new.pdf_path
    or old.created_by is distinct from new.created_by
    or old.generated_at is distinct from new.generated_at
  then
    raise exception 'Contract source snapshot is immutable';
  end if;

  return new;
end;
$$;

revoke all on function private.label_contract_preserve_snapshot() from public, anon, authenticated;

drop trigger if exists label_contracts_preserve_snapshot on public.label_contracts;
create trigger label_contracts_preserve_snapshot
  before update on public.label_contracts
  for each row execute function private.label_contract_preserve_snapshot();

drop trigger if exists label_contracts_touch_updated_at on public.label_contracts;
create trigger label_contracts_touch_updated_at
  before update on public.label_contracts
  for each row execute function private.label_readiness_touch_updated_at();

alter table public.label_contracts enable row level security;

drop policy if exists label_contracts_workspace_select on public.label_contracts;
drop policy if exists label_contracts_workspace_insert on public.label_contracts;
drop policy if exists label_contracts_workspace_update on public.label_contracts;

create policy label_contracts_workspace_select
  on public.label_contracts for select to authenticated
  using ((select private.label_current_user_has_workspace_access(workspace_id)));

create policy label_contracts_workspace_insert
  on public.label_contracts for insert to authenticated
  with check ((select private.label_current_user_has_workspace_access(workspace_id)));

create policy label_contracts_workspace_update
  on public.label_contracts for update to authenticated
  using ((select private.label_current_user_has_workspace_access(workspace_id)))
  with check ((select private.label_current_user_has_workspace_access(workspace_id)));

revoke all on public.label_contracts from public, anon, authenticated;
grant select, insert on public.label_contracts to authenticated;
grant update (
  status,
  signed_pdf_path,
  signed_file_name,
  sent_at,
  signed_at,
  expires_at,
  cancelled_at
) on public.label_contracts to authenticated;
