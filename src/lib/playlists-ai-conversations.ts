import "server-only";
import { normalizeCurationBrief } from "@/lib/playlists-ai-memory";
import { createClient } from "@/lib/supabase/server";
import type {
  PlaylistsAiChatResponse,
  PlaylistsAiConversationDetail,
  PlaylistsAiConversationStatus,
  PlaylistsAiConversationSummary,
  PlaylistsAiCurationBriefField,
  PlaylistsAiCurationBrief,
  PlaylistsAiPersistedMessage,
} from "@/types/playlists-ai";

type ConversationRow = {
  id: string;
  title: string;
  status: string;
  brief: unknown;
  latest_response?: unknown;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  response: unknown;
  created_at: string;
};

function asChatResponse(value: unknown): PlaylistsAiChatResponse | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<PlaylistsAiChatResponse>;
  return typeof record.text === "string" && Array.isArray(record.cards)
    ? (record as PlaylistsAiChatResponse)
    : null;
}

function asStoredBrief(value: unknown): PlaylistsAiCurationBrief {
  const normalized = normalizeCurationBrief(value);
  if (!value || typeof value !== "object") return normalized;
  const record = value as Record<string, unknown>;
  const allowedFields = new Set<PlaylistsAiCurationBriefField>([
    "goal",
    "market",
    "playlistMode",
    "playlistName",
    "genre",
    "audience",
    "strategy",
  ]);
  const missingFields = Array.isArray(record.missingFields)
    ? record.missingFields.filter(
        (field): field is PlaylistsAiCurationBriefField =>
          typeof field === "string" &&
          allowedFields.has(field as PlaylistsAiCurationBriefField),
      )
    : [];
  const completeness =
    typeof record.completeness === "number" &&
    Number.isFinite(record.completeness)
      ? Math.min(Math.max(Math.round(record.completeness), 0), 100)
      : 0;
  return { ...normalized, completeness, missingFields };
}

function mapConversation(row: ConversationRow): PlaylistsAiConversationSummary {
  return {
    id: row.id,
    title: row.title,
    status:
      row.status === "archived"
        ? ("archived" as PlaylistsAiConversationStatus)
        : "active",
    brief: asStoredBrief(row.brief),
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): PlaylistsAiPersistedMessage {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    result: asChatResponse(row.response),
    createdAt: row.created_at,
  };
}

export function titleFromPlaylistAiMessage(message: string) {
  const clean = message.trim().replace(/\s+/g, " ");
  if (!clean) return "Nova curadoria";
  return clean.length > 64 ? `${clean.slice(0, 63).trimEnd()}…` : clean;
}

export async function listPlaylistAiConversations({
  workspaceId,
  userId,
  limit = 30,
}: {
  workspaceId: string;
  userId: string;
  limit?: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playlist_ai_conversations")
    .select(
      "id,title,status,brief,last_message_at,created_at,updated_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) {
    throw new Error(`Playlists IA conversation list failed: ${error.message}`);
  }

  return ((data ?? []) as ConversationRow[]).map(mapConversation);
}

export async function getPlaylistAiConversation({
  conversationId,
  workspaceId,
  userId,
}: {
  conversationId: string;
  workspaceId: string;
  userId: string;
}): Promise<PlaylistsAiConversationDetail | null> {
  const supabase = await createClient();
  const [conversationResult, messageResult] = await Promise.all([
    supabase
      .from("playlist_ai_conversations")
      .select(
        "id,title,status,brief,latest_response,last_message_at,created_at,updated_at",
      )
      .eq("id", conversationId)
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("playlist_ai_messages")
      .select("id,role,content,response,created_at")
      .eq("conversation_id", conversationId)
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
  ]);

  if (conversationResult.error) {
    throw new Error(
      `Playlists IA conversation lookup failed: ${conversationResult.error.message}`,
    );
  }
  if (!conversationResult.data) return null;
  if (messageResult.error) {
    throw new Error(
      `Playlists IA message lookup failed: ${messageResult.error.message}`,
    );
  }

  const row = conversationResult.data as ConversationRow;
  return {
    ...mapConversation(row),
    latestResponse: asChatResponse(row.latest_response),
    messages: ((messageResult.data ?? []) as MessageRow[])
      .reverse()
      .map(mapMessage),
  };
}

export async function createPlaylistAiConversation({
  workspaceId,
  userId,
  title,
  brief,
}: {
  workspaceId: string;
  userId: string;
  title: string;
  brief: PlaylistsAiCurationBrief;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playlist_ai_conversations")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      title,
      brief,
    })
    .select("id,title,status,brief,last_message_at,created_at,updated_at")
    .single();

  if (error) {
    throw new Error(`Playlists IA conversation create failed: ${error.message}`);
  }
  return mapConversation(data as ConversationRow);
}

export async function appendPlaylistAiExchange({
  conversationId,
  workspaceId,
  userId,
  userMessage,
  assistantResponse,
}: {
  conversationId: string;
  workspaceId: string;
  userId: string;
  userMessage: string;
  assistantResponse: PlaylistsAiChatResponse;
}) {
  const supabase = await createClient();
  const userCreatedAt = new Date().toISOString();
  const assistantCreatedAt = new Date(Date.now() + 1).toISOString();
  const { error: messageError } = await supabase
    .from("playlist_ai_messages")
    .insert([
      {
        conversation_id: conversationId,
        workspace_id: workspaceId,
        user_id: userId,
        role: "user",
        content: userMessage,
        created_at: userCreatedAt,
      },
      {
        conversation_id: conversationId,
        workspace_id: workspaceId,
        user_id: userId,
        role: "assistant",
        content: assistantResponse.text,
        response: assistantResponse,
        created_at: assistantCreatedAt,
      },
    ]);

  if (messageError) {
    throw new Error(`Playlists IA message append failed: ${messageError.message}`);
  }

  const update: Record<string, unknown> = {
    brief: assistantResponse.brief,
    last_message_at: assistantCreatedAt,
  };
  if (assistantResponse.cards.length > 0) {
    update.latest_response = assistantResponse;
  }

  const { data, error: conversationError } = await supabase
    .from("playlist_ai_conversations")
    .update(update)
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .select("id,title,status,brief,last_message_at,created_at,updated_at")
    .single();

  if (conversationError) {
    throw new Error(
      `Playlists IA conversation update failed: ${conversationError.message}`,
    );
  }
  return mapConversation(data as ConversationRow);
}
