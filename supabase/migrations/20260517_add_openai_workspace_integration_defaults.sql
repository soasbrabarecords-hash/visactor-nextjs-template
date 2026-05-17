insert into public.workspace_integrations (
  workspace_id,
  provider,
  app_mode,
  connection_status
)
select
  workspaces.id,
  'openai',
  'global_app',
  'not_connected'
from public.workspaces
on conflict (workspace_id, provider) do nothing;
