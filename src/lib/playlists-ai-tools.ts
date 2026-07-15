import "server-only";
import {
  type TrackGenre,
  detectGenre,
  detectPlaylistGenre,
} from "@/lib/genre-detection";
import { getMusicIntelligence } from "@/lib/music-intelligence";
import {
  type SpotifyAccountPlaylist,
  type SpotifyEditablePlaylist,
  fetchSpotifyAccountPlaylists,
  fetchSpotifyEditablePlaylist,
  fetchSpotifyPlaylistTrackIds,
  withSpotifyToken,
} from "@/lib/spotify-user";
import type {
  MusicIntelligenceCountry,
  MusicIntelligenceTrack,
} from "@/types/music-intelligence";
import type { PlaylistsAiTrackCard } from "@/types/playlists-ai";

export type WorkspacePlaylistsToolResult = {
  connected: boolean;
  playlists: SpotifyAccountPlaylist[];
  message: string | null;
};

export type PlaylistTracksToolResult = {
  found: boolean;
  playlist: SpotifyEditablePlaylist | null;
  message: string | null;
};

export type SpotifyTrackSearchResult = {
  id: string;
  name: string;
  artists: string;
  imageUrl: string | null;
  spotifyUrl: string;
  popularity: number | null;
};

export type WorkspaceTrackIndex = {
  trackPlaylistNames: Map<string, string[]>;
  playlistsChecked: number;
  playlistsTotal: number;
  complete: boolean;
};

export type ChartOpportunitiesToolResult = {
  cards: PlaylistsAiTrackCard[];
  latestChartDate: string | null;
  maxWindow: number;
  status: string;
};

export type ChartTrackSignalToolResult = {
  track: MusicIntelligenceTrack | null;
  latestChartDate: string | null;
  maxWindow: number;
};

export type TrackPresenceToolResult = {
  track: SpotifyTrackSearchResult | null;
  playlistNames: string[];
  playlistsChecked: number;
  playlistsTotal: number;
  complete: boolean;
  message: string | null;
};

export type PlaylistRecommendationToolResult = {
  playlist: SpotifyEditablePlaylist | null;
  cards: PlaylistsAiTrackCard[];
  playlistGenre: TrackGenre;
  latestChartDate: string | null;
  maxWindow: number;
  message: string | null;
};

type SpotifySearchPayload = {
  tracks?: {
    items?: SpotifyApiTrack[];
  };
};

type SpotifyApiTrack = {
  id?: string;
  name?: string;
  popularity?: number;
  external_urls?: { spotify?: string };
  artists?: Array<{ name?: string }>;
  album?: { images?: Array<{ url?: string }> };
};

const ADJACENT_GENRES: Partial<Record<TrackGenre, TrackGenre[]>> = {
  trap: ["rap", "funk"],
  rap: ["trap"],
  funk: ["trap", "pagodao"],
  pagode: ["pagodao"],
  pagodao: ["pagode", "funk"],
  sertanejo: ["piseiro"],
  piseiro: ["sertanejo"],
};

export function normalizePlaylistAiText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function mapSpotifyApiTrack(
  track: SpotifyApiTrack,
): SpotifyTrackSearchResult | null {
  if (!track.id || !track.name) return null;

  return {
    id: track.id,
    name: track.name,
    artists:
      track.artists
        ?.map((artist) => artist.name)
        .filter(Boolean)
        .join(", ") || "Artista não informado",
    imageUrl: track.album?.images?.[0]?.url ?? null,
    spotifyUrl:
      track.external_urls?.spotify ??
      `https://open.spotify.com/track/${track.id}`,
    popularity: typeof track.popularity === "number" ? track.popularity : null,
  };
}

function resolveTrackId(value: string) {
  const direct = value.trim().match(/^[A-Za-z0-9]{22}$/)?.[0];
  if (direct) return direct;
  return (
    value.match(/(?:track\/|spotify:track:)([A-Za-z0-9]{22})/)?.[1] ?? null
  );
}

function artistNames(value: string) {
  return value
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bpart\.?\b/i)
    .map(normalizePlaylistAiText)
    .filter(Boolean);
}

function resolvePlaylist(
  reference: string,
  playlists: SpotifyAccountPlaylist[],
) {
  const normalizedReference = normalizePlaylistAiText(reference);
  if (!normalizedReference) return null;

  return (
    playlists.find((playlist) => playlist.id === reference.trim()) ??
    playlists.find(
      (playlist) =>
        normalizePlaylistAiText(playlist.name) === normalizedReference,
    ) ??
    playlists.find((playlist) =>
      normalizedReference.includes(normalizePlaylistAiText(playlist.name)),
    ) ??
    playlists.find((playlist) =>
      normalizePlaylistAiText(playlist.name).includes(normalizedReference),
    ) ??
    null
  );
}

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  iteratee: (item: TItem) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const workers = Array.from({
    length: Math.min(Math.max(concurrency, 1), items.length),
  }).map(async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await iteratee(items[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
}

function trackToCard(
  track: MusicIntelligenceTrack,
  options: {
    status?: PlaylistsAiTrackCard["status"];
    statusLabel?: string;
    playlistNames?: string[];
    suggestedAction?: string;
    reasonPrefix?: string;
    opportunityScore?: number;
  } = {},
): PlaylistsAiTrackCard {
  return {
    id: track.spotifyTrackId ?? track.id,
    spotifyTrackId: track.spotifyTrackId,
    spotifyUrl: track.spotifyUrl,
    coverUrl: track.coverUrl,
    name: track.name,
    artists: track.artists,
    opportunityScore: options.opportunityScore ?? track.scores.opportunityScore,
    positions: track.positions,
    movement7d: track.movement7d,
    reason: [options.reasonPrefix, track.explanation].filter(Boolean).join(" "),
    status:
      options.status ??
      (track.action === "watch" ? "watch" : "not_in_playlist"),
    statusLabel:
      options.statusLabel ??
      (track.action === "watch" ? "Observar" : "Ainda não está na playlist"),
    suggestedAction:
      options.suggestedAction ??
      (track.action === "watch"
        ? "Observar por 7 dias"
        : "Avaliar para adicionar"),
    playlistNames: options.playlistNames ?? [],
  };
}

export async function getWorkspacePlaylists(): Promise<WorkspacePlaylistsToolResult> {
  const { result } = await fetchSpotifyAccountPlaylists();

  if (!result.connected) {
    return {
      connected: false,
      playlists: [],
      message: result.message,
    };
  }

  return {
    connected: true,
    playlists: result.playlists,
    message: null,
  };
}

export async function getPlaylistTracks(
  playlistReference: string,
  knownPlaylists?: SpotifyAccountPlaylist[],
): Promise<PlaylistTracksToolResult> {
  const workspace = knownPlaylists
    ? { connected: true, playlists: knownPlaylists, message: null }
    : await getWorkspacePlaylists();

  if (!workspace.connected) {
    return {
      found: false,
      playlist: null,
      message:
        workspace.message ?? "Spotify não está conectado neste workspace.",
    };
  }

  const target = resolvePlaylist(playlistReference, workspace.playlists);
  if (!target) {
    return {
      found: false,
      playlist: null,
      message:
        "Não encontrei essa playlist entre as playlists deste workspace.",
    };
  }

  const { result } = await fetchSpotifyEditablePlaylist(target.id);
  if (!result.connected || !result.playlist) {
    return {
      found: false,
      playlist: null,
      message: result.message,
    };
  }

  return {
    found: true,
    playlist: result.playlist,
    message: null,
  };
}

export async function searchSpotifyTrack(
  query: string,
): Promise<SpotifyTrackSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const trackId = resolveTrackId(cleanQuery);
  const { data } = await withSpotifyToken(async (token) => {
    const url = trackId
      ? `https://api.spotify.com/v1/tracks/${trackId}?market=BR`
      : `https://api.spotify.com/v1/search?${new URLSearchParams({
          q: cleanQuery.slice(0, 160),
          type: "track",
          market: "BR",
          limit: "8",
        }).toString()}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Spotify search error ${response.status}.`);
    }

    if (trackId) {
      const track = mapSpotifyApiTrack(
        (await response.json()) as SpotifyApiTrack,
      );
      return track ? [track] : [];
    }

    const payload = (await response.json()) as SpotifySearchPayload;
    return (payload.tracks?.items ?? [])
      .map(mapSpotifyApiTrack)
      .filter((track): track is SpotifyTrackSearchResult => Boolean(track));
  });

  return data;
}

export async function getWorkspaceTrackIndex(
  playlists?: SpotifyAccountPlaylist[],
): Promise<WorkspaceTrackIndex> {
  const workspace = playlists
    ? { connected: true, playlists, message: null }
    : await getWorkspacePlaylists();

  if (!workspace.connected || workspace.playlists.length === 0) {
    return {
      trackPlaylistNames: new Map(),
      playlistsChecked: 0,
      playlistsTotal: workspace.playlists.length,
      complete: workspace.connected,
    };
  }

  const results = await mapWithConcurrency(
    workspace.playlists,
    3,
    async (playlist) => {
      const { result } = await fetchSpotifyPlaylistTrackIds(playlist.id);
      return { playlist, result };
    },
  );
  const trackPlaylistNames = new Map<string, string[]>();
  let playlistsChecked = 0;

  for (const { playlist, result } of results) {
    if (!result.success) continue;
    playlistsChecked += 1;
    for (const trackId of result.trackIds) {
      const names = trackPlaylistNames.get(trackId) ?? [];
      if (!names.includes(playlist.name)) names.push(playlist.name);
      trackPlaylistNames.set(trackId, names);
    }
  }

  return {
    trackPlaylistNames,
    playlistsChecked,
    playlistsTotal: workspace.playlists.length,
    complete: playlistsChecked === workspace.playlists.length,
  };
}

export async function searchTrackInPlaylists(
  trackQuery: string,
): Promise<TrackPresenceToolResult> {
  const [tracks, workspace] = await Promise.all([
    searchSpotifyTrack(trackQuery),
    getWorkspacePlaylists(),
  ]);
  const track = tracks[0] ?? null;

  if (!track) {
    return {
      track: null,
      playlistNames: [],
      playlistsChecked: 0,
      playlistsTotal: workspace.playlists.length,
      complete: false,
      message: "Não encontrei uma faixa correspondente na Spotify API.",
    };
  }

  if (!workspace.connected) {
    return {
      track,
      playlistNames: [],
      playlistsChecked: 0,
      playlistsTotal: 0,
      complete: false,
      message: workspace.message,
    };
  }

  const index = await getWorkspaceTrackIndex(workspace.playlists);
  return {
    track,
    playlistNames: index.trackPlaylistNames.get(track.id) ?? [],
    playlistsChecked: index.playlistsChecked,
    playlistsTotal: index.playlistsTotal,
    complete: index.complete,
    message: null,
  };
}

export async function getChartOpportunities({
  market = "BR",
  limit = 10,
  excludeTrackIds = new Set<string>(),
  mode = "opportunity",
}: {
  market?: MusicIntelligenceCountry;
  limit?: number;
  excludeTrackIds?: ReadonlySet<string>;
  mode?: "opportunity" | "heat" | "riser" | "review";
} = {}): Promise<ChartOpportunitiesToolResult> {
  const intelligence = await getMusicIntelligence();
  const pool = [...(intelligence.candidatePool[market] ?? [])].filter(
    (track) =>
      track.spotifyTrackId && !excludeTrackIds.has(track.spotifyTrackId),
  );

  const filtered = pool.filter((track) =>
    mode === "review" ? track.action === "review" : track.action !== "review",
  );
  const sorted = filtered.sort((left, right) => {
    if (mode === "heat") {
      return right.scores.heatScore - left.scores.heatScore;
    }
    if (mode === "riser") {
      return (right.movement7d ?? -999) - (left.movement7d ?? -999);
    }
    if (mode === "review") {
      return (
        right.scores.saturationRisk - left.scores.saturationRisk ||
        (left.movement7d ?? 0) - (right.movement7d ?? 0)
      );
    }
    return right.scores.opportunityScore - left.scores.opportunityScore;
  });

  return {
    cards: sorted.slice(0, clamp(limit, 1, 20)).map((track) =>
      trackToCard(track, {
        status: mode === "review" ? "already_in_playlist" : undefined,
        statusLabel: mode === "review" ? "Revisar presença" : undefined,
        suggestedAction:
          mode === "review" ? "Revisar antes de remover" : undefined,
      }),
    ),
    latestChartDate: intelligence.summary.latestChartDate,
    maxWindow: intelligence.summary.maxWindow,
    status: intelligence.summary.status,
  };
}

export async function getChartTrackSignal(
  spotifyTrackId: string,
): Promise<ChartTrackSignalToolResult> {
  const intelligence = await getMusicIntelligence();
  const track =
    [
      ...(intelligence.candidatePool.BR ?? []),
      ...(intelligence.candidatePool.GLOBAL ?? []),
    ].find((candidate) => candidate.spotifyTrackId === spotifyTrackId) ?? null;

  return {
    track,
    latestChartDate: intelligence.summary.latestChartDate,
    maxWindow: intelligence.summary.maxWindow,
  };
}

function inferPlaylistGenre(playlist: SpotifyEditablePlaylist) {
  const explicit = detectPlaylistGenre(playlist.name, playlist.description);
  if (explicit !== "unknown") return explicit;

  const counts = new Map<TrackGenre, number>();
  for (const track of playlist.tracks) {
    const genre = detectGenre(track.artists, track.name);
    if (genre !== "unknown") counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }

  return (
    [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
    "unknown"
  );
}

function getPlaylistFit(
  track: MusicIntelligenceTrack,
  genre: TrackGenre,
  playlistArtists: Set<string>,
) {
  const sharedArtist = artistNames(track.artists).some((artist) =>
    playlistArtists.has(artist),
  );
  if (sharedArtist)
    return { score: 100, reason: "Artista já validado no repertório." };

  const trackGenre = detectGenre(track.artists, track.name);
  if (genre === "unknown") {
    return { score: 58, reason: "Fit estimado pelos sinais atuais do chart." };
  }
  if (trackGenre === genre) {
    return {
      score: 100,
      reason: "Gênero compatível com o perfil da playlist.",
    };
  }
  if (ADJACENT_GENRES[genre]?.includes(trackGenre)) {
    return { score: 74, reason: "Gênero adjacente ao perfil da playlist." };
  }
  if (trackGenre === "unknown") {
    return { score: 48, reason: "Gênero ainda não confirmado." };
  }
  return { score: 18, reason: "Baixa afinidade de gênero." };
}

export async function recommendTracksForPlaylist(
  playlistReference: string,
  { limit = 10 }: { limit?: number } = {},
): Promise<PlaylistRecommendationToolResult> {
  const workspace = await getWorkspacePlaylists();
  if (!workspace.connected) {
    return {
      playlist: null,
      cards: [],
      playlistGenre: "unknown",
      latestChartDate: null,
      maxWindow: 0,
      message: workspace.message,
    };
  }

  const playlistResult = await getPlaylistTracks(
    playlistReference,
    workspace.playlists,
  );
  if (!playlistResult.found || !playlistResult.playlist) {
    return {
      playlist: null,
      cards: [],
      playlistGenre: "unknown",
      latestChartDate: null,
      maxWindow: 0,
      message: playlistResult.message,
    };
  }

  const playlist = playlistResult.playlist;
  const intelligence = await getMusicIntelligence();
  const playlistGenre = inferPlaylistGenre(playlist);
  const existingTrackIds = new Set(playlist.tracks.map((track) => track.id));
  const playlistArtists = new Set(
    playlist.tracks.flatMap((track) => artistNames(track.artists)),
  );
  const marketOrder: MusicIntelligenceCountry[] = ["BR", "GLOBAL"];
  const candidates = marketOrder.flatMap((market) =>
    (intelligence.candidatePool[market] ?? []).map((track) => ({
      market,
      track,
    })),
  );
  const seen = new Set<string>();
  const ranked = candidates
    .flatMap(({ market, track }) => {
      if (
        !track.spotifyTrackId ||
        existingTrackIds.has(track.spotifyTrackId) ||
        track.action === "review" ||
        seen.has(track.spotifyTrackId)
      ) {
        return [];
      }
      seen.add(track.spotifyTrackId);
      const fit = getPlaylistFit(track, playlistGenre, playlistArtists);
      const score = Math.round(
        clamp(track.scores.opportunityScore * 0.68 + fit.score * 0.32),
      );
      return [{ market, track, fit, score }];
    })
    .filter(({ fit }) => playlistGenre === "unknown" || fit.score >= 70)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.track.scores.opportunityScore -
          left.track.scores.opportunityScore,
    )
    .slice(0, clamp(limit, 1, 20));

  return {
    playlist,
    cards: ranked.map(({ track, fit, score }) =>
      trackToCard(track, {
        status: track.action === "watch" ? "watch" : "not_in_playlist",
        statusLabel:
          track.action === "watch" ? "Observar" : `Fora de ${playlist.name}`,
        suggestedAction:
          track.action === "watch"
            ? "Observar por 7 dias"
            : `Avaliar para ${playlist.name}`,
        reasonPrefix: `${fit.reason} Fit ${score}/100.`,
        opportunityScore: score,
      }),
    ),
    playlistGenre,
    latestChartDate: intelligence.summary.latestChartDate,
    maxWindow: intelligence.summary.maxWindow,
    message:
      ranked.length > 0
        ? null
        : "Não encontrei candidatas com afinidade e sinais suficientes para recomendar agora.",
  };
}
