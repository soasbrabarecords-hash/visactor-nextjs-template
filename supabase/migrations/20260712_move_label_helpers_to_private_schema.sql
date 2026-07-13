-- Production follow-up for projects where the first isolation migration was
-- applied before the helper functions were moved out of the exposed schema.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

do $$
begin
  if to_regprocedure('public.label_current_user_has_workspace_access(uuid)') is not null then
    alter function public.label_current_user_has_workspace_access(uuid) set schema private;
  end if;

  if to_regprocedure('public.label_storage_workspace_id(text)') is not null then
    alter function public.label_storage_workspace_id(text) set schema private;
  end if;
end
$$;

revoke all on function private.label_current_user_has_workspace_access(uuid) from public, anon;
revoke all on function private.label_storage_workspace_id(text) from public, anon;
grant execute on function private.label_current_user_has_workspace_access(uuid) to authenticated;
grant execute on function private.label_storage_workspace_id(text) to authenticated;

drop policy if exists "label os read public covers" on storage.objects;
