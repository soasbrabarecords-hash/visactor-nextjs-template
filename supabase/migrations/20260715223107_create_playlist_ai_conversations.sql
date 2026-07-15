create table public.playlist_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'archived')),
  brief jsonb not null default '{}'::jsonb check (jsonb_typeof(brief) = 'object'),
  latest_response jsonb check (
    latest_response is null or jsonb_typeof(latest_response) = 'object'
  ),
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, workspace_id, user_id)
);

create table public.playlist_ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(btrim(content)) between 1 and 8000),
  response jsonb check (response is null or jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (conversation_id, workspace_id, user_id)
    references public.playlist_ai_conversations (id, workspace_id, user_id)
    on delete cascade
);

create index playlist_ai_conversations_owner_activity_idx
  on public.playlist_ai_conversations (
    workspace_id,
    user_id,
    status,
    last_message_at desc nulls last,
    created_at desc
  );

create index playlist_ai_messages_conversation_timeline_idx
  on public.playlist_ai_messages (
    workspace_id,
    user_id,
    conversation_id,
    created_at,
    id
  );

create or replace function private.playlist_ai_user_has_workspace_access(
  target_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_users wu
    where wu.workspace_id = target_workspace_id
      and wu.user_id = (select auth.uid())
      and wu.status = 'active'
  ) or exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

revoke all on function private.playlist_ai_user_has_workspace_access(uuid)
  from public;
grant execute on function private.playlist_ai_user_has_workspace_access(uuid)
  to authenticated;

create or replace function private.playlist_ai_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function private.playlist_ai_touch_updated_at() from public;

create trigger playlist_ai_conversations_touch_updated_at
before update on public.playlist_ai_conversations
for each row execute function private.playlist_ai_touch_updated_at();

alter table public.playlist_ai_conversations enable row level security;
alter table public.playlist_ai_messages enable row level security;

revoke all on public.playlist_ai_conversations from anon, authenticated;
revoke all on public.playlist_ai_messages from anon, authenticated;

grant select, insert, update, delete
  on public.playlist_ai_conversations to authenticated;
grant select, insert
  on public.playlist_ai_messages to authenticated;
grant all on public.playlist_ai_conversations to service_role;
grant all on public.playlist_ai_messages to service_role;

create policy "users read their own playlist ai conversations"
on public.playlist_ai_conversations
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.playlist_ai_user_has_workspace_access(workspace_id))
);

create policy "users create their own playlist ai conversations"
on public.playlist_ai_conversations
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.playlist_ai_user_has_workspace_access(workspace_id))
);

create policy "users update their own playlist ai conversations"
on public.playlist_ai_conversations
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.playlist_ai_user_has_workspace_access(workspace_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.playlist_ai_user_has_workspace_access(workspace_id))
);

create policy "users delete their own playlist ai conversations"
on public.playlist_ai_conversations
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.playlist_ai_user_has_workspace_access(workspace_id))
);

create policy "users read messages from their own playlist ai conversations"
on public.playlist_ai_messages
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.playlist_ai_user_has_workspace_access(workspace_id))
);

create policy "users append messages to their own playlist ai conversations"
on public.playlist_ai_messages
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.playlist_ai_user_has_workspace_access(workspace_id))
);

comment on table public.playlist_ai_conversations is
  'Private, workspace-scoped Playlists IA conversation memory owned by one user.';

comment on table public.playlist_ai_messages is
  'Append-only user and assistant transcript for a Playlists IA conversation.';
