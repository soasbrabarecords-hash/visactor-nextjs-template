import type { MusicIntelligenceCountry } from "@/types/music-intelligence";

export type PlaylistsAiIntent =
  | "chart_opportunities"
  | "playlist_recommendations"
  | "track_presence"
  | "playlist_review"
  | "playlist_idea"
  | "playlist_description"
  | "general";

export type PlaylistsAiTrackStatus =
  "already_in_playlist" | "not_in_playlist" | "watch";

export type PlaylistsAiTrackCard = {
  id: string;
  spotifyTrackId: string | null;
  spotifyUrl: string | null;
  coverUrl: string | null;
  name: string;
  artists: string;
  opportunityScore: number | null;
  positions: Partial<Record<MusicIntelligenceCountry, number>>;
  movement7d: number | null;
  reason: string;
  status: PlaylistsAiTrackStatus;
  statusLabel: string;
  suggestedAction: string;
  playlistNames: string[];
};

export type PlaylistsAiPreparedActionType =
  | "add_to_playlist"
  | "watch_7_days"
  | "create_playlist"
  | "update_description"
  | "reorder_top_20";

export type PlaylistsAiPreparedAction = {
  id: string;
  type: PlaylistsAiPreparedActionType;
  label: string;
  description: string;
  disabled: true;
  payload: Record<string, unknown>;
};

export type PlaylistsAiDataSource = {
  id:
    | "spotify_charts"
    | "workspace_playlists"
    | "spotify_api"
    | "music_intelligence";
  label: string;
  detail: string;
  status: "used" | "partial" | "unavailable";
};

export type PlaylistsAiChatResponse = {
  text: string;
  cards: PlaylistsAiTrackCard[];
  actions: PlaylistsAiPreparedAction[];
  confidence: number;
  dataSources: PlaylistsAiDataSource[];
  meta: {
    intent: PlaylistsAiIntent;
    readOnly: true;
    generatedAt: string;
  };
};

export type PlaylistsAiConversationMessage = {
  role: "user" | "assistant";
  content: string;
};
