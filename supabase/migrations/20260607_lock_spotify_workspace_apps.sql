-- Keep the central Spotify app reserved for the admin workspace.
-- Client workspaces must authorize their own Spotify app and token.

insert into public.workspace_integrations (
  workspace_id,
  provider,
  app_mode,
  connection_status
)
select
  workspaces.id,
  'spotify',
  'workspace_app',
  'not_connected'
from public.workspaces
where workspaces.slug <> 'so-as-braba-records'
on conflict (workspace_id, provider) do nothing;

update public.workspace_integrations as integrations
set
  app_mode = 'workspace_app',
  connection_status = 'not_connected',
  provider_account_id = null,
  provider_account_label = null,
  access_token = null,
  refresh_token = null,
  token_expires_at = null,
  granted_scopes = null,
  updated_at = now()
from public.workspaces
where integrations.workspace_id = workspaces.id
  and integrations.provider = 'spotify'
  and workspaces.slug <> 'so-as-braba-records'
  and integrations.app_mode <> 'workspace_app';
