create index playlist_ai_conversations_user_idx
  on public.playlist_ai_conversations (user_id);

drop index public.playlist_ai_messages_conversation_timeline_idx;

create index playlist_ai_messages_conversation_timeline_idx
  on public.playlist_ai_messages (
    conversation_id,
    workspace_id,
    user_id,
    created_at,
    id
  );
