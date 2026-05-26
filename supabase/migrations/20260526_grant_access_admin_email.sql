insert into public.workspace_users (workspace_id, user_id, role, status)
select workspaces.id, users.id, 'owner', 'active'
from public.workspaces workspaces
join auth.users users on lower(users.email) = 'contato@soasbraba.com'
where workspaces.slug = 'so-as-braba-records'
on conflict (workspace_id, user_id) do update
set role = 'owner',
    status = 'active',
    updated_at = now();

insert into public.workspace_memberships (workspace_id, user_id, role)
select workspaces.id, users.id, 'owner'
from public.workspaces workspaces
join auth.users users on lower(users.email) = 'contato@soasbraba.com'
where workspaces.slug = 'so-as-braba-records'
on conflict (workspace_id, user_id) do update
set role = 'owner';

insert into public.module_roles (workspace_id, user_id, module_key, role)
select workspaces.id, users.id, modules.module_key, 'admin'
from public.workspaces workspaces
join auth.users users on lower(users.email) = 'contato@soasbraba.com'
cross join (
  values ('playlist_os'), ('label_os'), ('artist_os')
) as modules(module_key)
where workspaces.slug = 'so-as-braba-records'
on conflict (workspace_id, user_id, module_key) do update
set role = 'admin',
    updated_at = now();
