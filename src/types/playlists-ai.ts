import type { MusicIntelligenceCountry } from "@/types/music-intelligence";
import type { TrackGenreCardProfile } from "@/types/track-profile";

export type PlaylistsAiIntent =
  | "chart_opportunities"
  | "playlist_recommendations"
  | "track_presence"
  | "playlist_review"
  | "playlist_idea"
  | "playlist_description"
  | "general";

export type PlaylistsAiResponseMode =
  "question" | "analysis" | "recommendation";

export type PlaylistsAiCurationGoal =
  "growth" | "editorial" | "discovery" | "hits" | "retention" | "balanced";

export type PlaylistsAiCurationMarket = MusicIntelligenceCountry | "BOTH";

export type PlaylistsAiPlaylistMode = "existing" | "new";

export type PlaylistsAiCurationStrategy =
  "retention" | "discovery" | "renewal" | "hits" | "balanced";

export type PlaylistsAiCurationBriefField =
  | "goal"
  | "market"
  | "playlistMode"
  | "playlistName"
  | "genre"
  | "audience"
  | "strategy";

export type PlaylistsAiCurationBrief = {
  goal: PlaylistsAiCurationGoal | null;
  market: PlaylistsAiCurationMarket | null;
  playlistMode: PlaylistsAiPlaylistMode | null;
  playlistName: string | null;
  genre: string | null;
  audience: string | null;
  strategy: PlaylistsAiCurationStrategy | null;
  targetSize: number | null;
  activeIntent: PlaylistsAiIntent | null;
  completeness: number;
  missingFields: PlaylistsAiCurationBriefField[];
};

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
  genreProfile?: TrackGenreCardProfile | null;
  playlistFit?: {
    score: number;
    label: "alto" | "medio" | "baixo" | "indeterminado";
    reason: string;
  } | null;
  historicalMetrics?: {
    windowDays: number;
    chartDays: number;
    appearances: number;
    totalStreams: number;
    averageDailyStreams: number | null;
    bestPosition: number;
    averagePosition: number;
    firstChartDate: string;
    lastChartDate: string;
  } | null;
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
    | "music_intelligence"
    | "genre_intelligence";
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
  brief: PlaylistsAiCurationBrief;
  meta: {
    intent: PlaylistsAiIntent;
    mode: PlaylistsAiResponseMode;
    contextComplete: boolean;
    readOnly: true;
    generatedAt: string;
  };
};

export type PlaylistsAiConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PlaylistsAiConversationStatus = "active" | "archived";

export type PlaylistsAiConversationSummary = {
  id: string;
  title: string;
  status: PlaylistsAiConversationStatus;
  brief: PlaylistsAiCurationBrief;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlaylistsAiPersistedMessage = PlaylistsAiConversationMessage & {
  id: string;
  result: PlaylistsAiChatResponse | null;
  createdAt: string;
};

export type PlaylistsAiConversationDetail = PlaylistsAiConversationSummary & {
  latestResponse: PlaylistsAiChatResponse | null;
  messages: PlaylistsAiPersistedMessage[];
};

export type PlaylistsAiChatApiResponse = PlaylistsAiChatResponse & {
  conversation: PlaylistsAiConversationSummary;
};
