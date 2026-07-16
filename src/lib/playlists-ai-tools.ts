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
import { createAdminClient } from "@/lib/supabase/admin";
import { getTrackGenreProfiles } from "@/lib/track-profile-engine";
import { getCurrentWorkspaceSelection } from "@/lib/workspaces";
import type {
  MusicIntelligenceCountry,
  MusicIntelligenceTrack,
} from "@/types/music-intelligence";
import type {
  PlaylistsAiCurationMarket,
  PlaylistsAiTrackCard,
} from "@/types/playlists-ai";
import {
  TRACK_PROFILE_GENRE_LABELS,
  type TrackGenreCardProfile,
  type TrackGenreProfile,
  type TrackProfileGenre,
} from "@/types/track-profile";

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
  windowDays?: number;
  windowStartDate?: string | null;
  historical?: boolean;
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
  genreProfile?: TrackGenreCardProfile | null;
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

type HistoricalChartRankingRow = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  primary_genre: TrackProfileGenre | null;
  genre_confidence: number | null;
  countries: MusicIntelligenceCountry[] | null;
  chart_days: number;
  chart_appearances: number;
  total_streams: number;
  average_daily_streams: number | null;
  best_position: number;
  average_position: number;
  first_chart_date: string;
  last_chart_date: string;
  current_position_br: number | null;
  current_position_global: number | null;
  position_7d_br: number | null;
  position_7d_global: number | null;
  image_url: string | null;
  latest_chart_date: string;
  window_start_date: string;
  available_days: number;
};

const ADJACENT_PROFILE_GENRES: Partial<
  Record<TrackProfileGenre, TrackProfileGenre[]>
> = {
  funk: ["trap", "rap"],
  trap: ["rap", "funk"],
  rap: ["trap", "funk"],
  sertanejo: ["piseiro_forro"],
  piseiro_forro: ["sertanejo"],
  pop: ["pop_global", "dance_eletronico"],
  pop_global: ["pop", "dance_eletronico", "afro_latin"],
  dance_eletronico: ["pop_global", "pop", "afro_latin"],
  afro_latin: ["pop_global", "dance_eletronico"],
};

function genreCardProfile(
  profile: TrackGenreProfile | null | undefined,
): TrackGenreCardProfile | null {
  if (!profile) return null;
  return {
    primaryGenre: profile.primaryGenre,
    label: TRACK_PROFILE_GENRE_LABELS[profile.primaryGenre],
    genreConfidence: profile.genreConfidence,
    confidenceLabel: profile.confidenceLabel,
    manualOverride: profile.manualOverride,
  };
}

async function loadProfilesForIntelligenceTracks(
  tracks: MusicIntelligenceTrack[],
  options: {
    playlistContext?: Array<{ name: string; description?: string | null }>;
  } = {},
) {
  const selection = await getCurrentWorkspaceSelection();
  return getTrackGenreProfiles(
    tracks.flatMap((track) =>
      track.spotifyTrackId
        ? [
            {
              spotifyTrackId: track.spotifyTrackId,
              name: track.name,
              artists: track.artists,
              chartCountry: track.primaryCountry,
              playlistContext: options.playlistContext,
            },
          ]
        : [],
    ),
    {
      workspaceId: selection?.workspace.id,
      persistFallbacks: true,
    },
  );
}

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

function compactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
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
    genreProfile?: TrackGenreProfile | null;
    playlistFit?: PlaylistsAiTrackCard["playlistFit"];
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
    genreProfile: genreCardProfile(options.genreProfile),
    playlistFit: options.playlistFit ?? null,
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
  const selection = await getCurrentWorkspaceSelection();
  const profiles = await getTrackGenreProfiles(
    [
      {
        spotifyTrackId: track.id,
        name: track.name,
        artists: track.artists,
      },
    ],
    { workspaceId: selection?.workspace.id },
  );
  return {
    track,
    playlistNames: index.trackPlaylistNames.get(track.id) ?? [],
    playlistsChecked: index.playlistsChecked,
    playlistsTotal: index.playlistsTotal,
    complete: index.complete,
    message: null,
    genreProfile: genreCardProfile(profiles.get(track.id)),
  };
}

async function getHistoricalChartRankings({
  market,
  limit,
  windowDays,
  genres,
  excludeTrackIds,
}: {
  market: PlaylistsAiCurationMarket;
  limit: number;
  windowDays: number;
  genres: TrackProfileGenre[];
  excludeTrackIds: ReadonlySet<string>;
}): Promise<ChartOpportunitiesToolResult> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      cards: [],
      latestChartDate: null,
      maxWindow: 0,
      status: "unavailable",
      windowDays,
      windowStartDate: null,
      historical: true,
    };
  }

  const countries: MusicIntelligenceCountry[] =
    market === "BOTH" ? ["BR", "GLOBAL"] : [market];
  const requestedLimit = clamp(limit + excludeTrackIds.size, 1, 50);
  const genreFilters: Array<TrackProfileGenre | null> = genres.length
    ? [...genres, null]
    : [null];
  const results = await Promise.all(
    genreFilters.map((primaryGenre) =>
      admin.rpc("get_spotify_chart_history_rankings", {
        p_window_days: clamp(windowDays, 1, 365),
        p_countries: countries,
        p_primary_genre: primaryGenre,
        // The unfiltered pass recovers chart tracks whose profile has not been
        // enriched yet. It remains bounded to the RPC's protected maximum.
        p_limit: genres.length ? 50 : requestedLimit,
      }),
    ),
  );
  const failed = results.find((result) => result.error)?.error;
  if (failed) {
    throw new Error(`Historical chart ranking failed: ${failed.message}`);
  }

  const merged = new Map<string, HistoricalChartRankingRow>();
  for (const result of results) {
    for (const row of (result.data ?? []) as HistoricalChartRankingRow[]) {
      const existing = merged.get(row.spotify_track_id);
      if (!existing || row.total_streams > existing.total_streams) {
        merged.set(row.spotify_track_id, row);
      }
    }
  }

  const resolvedGenres = new Map<string, TrackProfileGenre>();
  const rows = [...merged.values()]
    .filter((row) => !excludeTrackIds.has(row.spotify_track_id))
    .filter((row) => {
      if (genres.length === 0) return true;
      const detected = mapLegacyGenre(
        detectGenre(row.artist_name, row.track_name),
      );
      const resolved =
        detected !== "desconhecido" ? detected : row.primary_genre;
      if (!resolved || !genres.includes(resolved)) return false;
      resolvedGenres.set(row.spotify_track_id, resolved);
      return true;
    })
    .sort(
      (left, right) =>
        right.total_streams - left.total_streams ||
        right.chart_days - left.chart_days ||
        left.best_position - right.best_position,
    );

  const selectionLimit = clamp(limit, 1, 20);
  const selected: HistoricalChartRankingRow[] = [];
  if (genres.length <= 1) {
    selected.push(...rows.slice(0, selectionLimit));
  } else {
    const buckets = genres.map((genre) =>
      rows.filter((row) => resolvedGenres.get(row.spotify_track_id) === genre),
    );
    let cursor = 0;
    while (
      selected.length < selectionLimit &&
      buckets.some((bucket) => cursor < bucket.length)
    ) {
      for (const bucket of buckets) {
        const row = bucket[cursor];
        if (row && selected.length < selectionLimit) selected.push(row);
      }
      cursor += 1;
    }
  }
  const selection = await getCurrentWorkspaceSelection();
  const profiles = await getTrackGenreProfiles(
    selected.map((row) => ({
      spotifyTrackId: row.spotify_track_id,
      name: row.track_name,
      artists: row.artist_name,
      chartCountry: row.countries?.includes("BR") ? "BR" : "GLOBAL",
    })),
    { workspaceId: selection?.workspace.id },
  );

  const cards = selected.map((row): PlaylistsAiTrackCard => {
    const positions: PlaylistsAiTrackCard["positions"] = {};
    if (row.current_position_br !== null) {
      positions.BR = row.current_position_br;
    }
    if (row.current_position_global !== null) {
      positions.GLOBAL = row.current_position_global;
    }
    const currentPosition =
      market === "GLOBAL"
        ? row.current_position_global
        : market === "BR"
          ? row.current_position_br
          : (row.current_position_br ?? row.current_position_global);
    const position7d =
      market === "GLOBAL"
        ? row.position_7d_global
        : market === "BR"
          ? row.position_7d_br
          : (row.position_7d_br ?? row.position_7d_global);
    const movement7d =
      currentPosition !== null && position7d !== null
        ? position7d - currentPosition
        : null;
    const coverageScore = clamp((row.chart_days / windowDays) * 45);
    const positionScore = clamp((1 - (row.average_position - 1) / 199) * 40);
    const recencyScore = row.last_chart_date === row.latest_chart_date ? 15 : 0;
    const historicalScore = Math.round(
      coverageScore + positionScore + recencyScore,
    );
    const profile = profiles.get(row.spotify_track_id);
    const resolvedGenre = resolvedGenres.get(row.spotify_track_id) ?? null;
    const effectiveGenre =
      profile?.primaryGenre && profile.primaryGenre !== "desconhecido"
        ? profile.primaryGenre
        : resolvedGenre;
    const genreLabel = effectiveGenre
      ? `${TRACK_PROFILE_GENRE_LABELS[effectiveGenre]} (${profile?.primaryGenre === effectiveGenre ? profile.genreConfidence : 38}% de confiança)`
      : "gênero em análise";
    const marketNames = (row.countries ?? countries)
      .map((country) => (country === "BR" ? "BR" : "Global"))
      .join(" + ");

    return {
      id: row.spotify_track_id,
      spotifyTrackId: row.spotify_track_id,
      spotifyUrl: `https://open.spotify.com/track/${row.spotify_track_id}`,
      coverUrl: row.image_url,
      name: row.track_name,
      artists: row.artist_name || "Artista não informado",
      opportunityScore: historicalScore,
      positions,
      movement7d,
      reason: `${row.chart_days} de ${windowDays} dias no Top 200 ${marketNames}, ${compactNumber(row.total_streams)} streams acumulados, melhor posição #${row.best_position} e média #${row.average_position}. Classificação: ${genreLabel}.`,
      status: "not_in_playlist",
      statusLabel: "Resultado histórico",
      suggestedAction: "Avaliar para curadoria",
      playlistNames: [],
      genreProfile:
        profile?.primaryGenre && profile.primaryGenre !== "desconhecido"
          ? genreCardProfile(profile)
          : effectiveGenre
            ? {
                primaryGenre: effectiveGenre,
                label: TRACK_PROFILE_GENRE_LABELS[effectiveGenre],
                genreConfidence: 38,
                confidenceLabel: "baixa",
                manualOverride: false,
              }
            : null,
      playlistFit: null,
      historicalMetrics: {
        windowDays,
        chartDays: row.chart_days,
        appearances: row.chart_appearances,
        totalStreams: row.total_streams,
        averageDailyStreams: row.average_daily_streams,
        bestPosition: row.best_position,
        averagePosition: row.average_position,
        firstChartDate: row.first_chart_date,
        lastChartDate: row.last_chart_date,
      },
    };
  });

  return {
    cards,
    latestChartDate: selected[0]?.latest_chart_date ?? null,
    maxWindow: selected[0]?.available_days ?? 0,
    status: cards.length > 0 ? "ready" : "partial",
    windowDays,
    windowStartDate: selected[0]?.window_start_date ?? null,
    historical: true,
  };
}

export async function getChartOpportunities({
  market = "BR",
  limit = 10,
  excludeTrackIds = new Set<string>(),
  mode = "opportunity",
  windowDays,
  genre = null,
  genres,
}: {
  market?: PlaylistsAiCurationMarket;
  limit?: number;
  excludeTrackIds?: ReadonlySet<string>;
  mode?: "opportunity" | "heat" | "riser" | "review" | "historical";
  windowDays?: number;
  genre?: TrackProfileGenre | null;
  genres?: TrackProfileGenre[];
} = {}): Promise<ChartOpportunitiesToolResult> {
  const requestedGenres = [
    ...new Set([...(genres ?? []), ...(genre ? [genre] : [])]),
  ];
  if (mode === "historical") {
    return getHistoricalChartRankings({
      market,
      limit,
      windowDays: windowDays ?? 30,
      genres: requestedGenres,
      excludeTrackIds,
    });
  }

  const intelligence = await getMusicIntelligence();
  const marketTracks =
    market === "BOTH"
      ? [
          ...(intelligence.candidatePool.BR ?? []),
          ...(intelligence.candidatePool.GLOBAL ?? []),
        ]
      : [...(intelligence.candidatePool[market] ?? [])];
  const uniqueTracks = new Map<string, MusicIntelligenceTrack>();
  for (const track of marketTracks) {
    if (!track.spotifyTrackId || excludeTrackIds.has(track.spotifyTrackId))
      continue;
    const existing = uniqueTracks.get(track.spotifyTrackId);
    if (!existing) {
      uniqueTracks.set(track.spotifyTrackId, track);
      continue;
    }
    const strongest =
      track.scores.opportunityScore > existing.scores.opportunityScore
        ? track
        : existing;
    uniqueTracks.set(track.spotifyTrackId, {
      ...strongest,
      countries: [...new Set([...existing.countries, ...track.countries])],
      positions: { ...existing.positions, ...track.positions },
    });
  }
  const pool = [...uniqueTracks.values()];

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

  const profileCandidates =
    requestedGenres.length > 0 ? sorted : sorted.slice(0, clamp(limit, 1, 20));
  const profiles = await loadProfilesForIntelligenceTracks(profileCandidates);
  const genreFiltered =
    requestedGenres.length > 0
      ? sorted.filter((track) => {
          if (!track.spotifyTrackId) return false;
          const detected = mapLegacyGenre(
            detectGenre(track.artists, track.name),
          );
          const resolved =
            detected !== "desconhecido"
              ? detected
              : (profiles.get(track.spotifyTrackId)?.primaryGenre ??
                "desconhecido");
          if (!requestedGenres.includes(resolved)) return false;
          return true;
        })
      : sorted;
  const selected = genreFiltered.slice(0, clamp(limit, 1, 20));

  return {
    cards: selected.map((track) =>
      trackToCard(track, {
        status: mode === "review" ? "already_in_playlist" : undefined,
        statusLabel: mode === "review" ? "Revisar presença" : undefined,
        suggestedAction:
          mode === "review" ? "Revisar antes de remover" : undefined,
        genreProfile: track.spotifyTrackId
          ? profiles.get(track.spotifyTrackId)
          : null,
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

function mapLegacyGenre(genre: TrackGenre): TrackProfileGenre {
  if (genre === "piseiro") return "piseiro_forro";
  if (
    genre === "funk" ||
    genre === "trap" ||
    genre === "rap" ||
    genre === "sertanejo" ||
    genre === "pop" ||
    genre === "rock"
  ) {
    return genre;
  }
  return "desconhecido";
}

function getPlaylistFit(
  trackProfile: TrackGenreProfile | null | undefined,
  genre: TrackProfileGenre,
  playlistArtists: Set<string>,
  trackArtists: string,
) {
  const sharedArtist = artistNames(trackArtists).some((artist) =>
    playlistArtists.has(artist),
  );
  if (sharedArtist)
    return {
      score: 100,
      label: "alto" as const,
      reason: "Artista já validado no repertório.",
    };

  const trackGenre = trackProfile?.primaryGenre ?? "desconhecido";
  if (genre === "desconhecido") {
    return {
      score: 58,
      label: "indeterminado" as const,
      reason: "Fit estimado pelos sinais atuais do chart.",
    };
  }
  if (trackGenre === genre) {
    return {
      score: 100,
      label: "alto" as const,
      reason: "Gênero compatível com o perfil da playlist.",
    };
  }
  if (ADJACENT_PROFILE_GENRES[genre]?.includes(trackGenre)) {
    return {
      score: 74,
      label: "medio" as const,
      reason: "Gênero adjacente ao perfil da playlist.",
    };
  }
  if (trackGenre === "desconhecido") {
    return {
      score: 48,
      label: "indeterminado" as const,
      reason:
        "Gênero ainda não confirmado; recomendação mantida em observação.",
    };
  }
  return {
    score: 18,
    label: "baixo" as const,
    reason: "Quente nos charts, mas fora do gênero principal da playlist.",
  };
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
  const selection = await getCurrentWorkspaceSelection();
  const playlistContext = [
    { name: playlist.name, description: playlist.description },
  ];
  const playlistProfiles = await getTrackGenreProfiles(
    playlist.tracks.map((track) => ({
      spotifyTrackId: track.id,
      name: track.name,
      artists: track.artists,
      albumName: track.albumName,
      playlistContext,
    })),
    {
      workspaceId: selection?.workspace.id,
      persistFallbacks: true,
    },
  );
  const playlistGenreCounts = new Map<TrackProfileGenre, number>();
  for (const profile of playlistProfiles.values()) {
    if (profile.primaryGenre === "desconhecido") continue;
    playlistGenreCounts.set(
      profile.primaryGenre,
      (playlistGenreCounts.get(profile.primaryGenre) ?? 0) + 1,
    );
  }
  const playlistProfileGenre =
    [...playlistGenreCounts.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0]?.[0] ?? mapLegacyGenre(playlistGenre);
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
  const eligible = candidates
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
      return [{ market, track }];
    })
    .sort(
      (left, right) =>
        right.track.scores.opportunityScore -
        left.track.scores.opportunityScore,
    )
    .slice(0, 120);
  const candidateProfiles = await loadProfilesForIntelligenceTracks(
    eligible.map(({ track }) => track),
    { playlistContext },
  );
  const ranked = eligible
    .map(({ market, track }) => {
      const profile = track.spotifyTrackId
        ? candidateProfiles.get(track.spotifyTrackId)
        : null;
      const fit = getPlaylistFit(
        profile,
        playlistProfileGenre,
        playlistArtists,
        track.artists,
      );
      const score = Math.round(
        clamp(track.scores.opportunityScore * 0.68 + fit.score * 0.32),
      );
      return { market, track, profile, fit, score };
    })
    .filter(
      ({ fit }) => playlistProfileGenre === "desconhecido" || fit.score >= 70,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.track.scores.opportunityScore -
          left.track.scores.opportunityScore,
    )
    .slice(0, clamp(limit, 1, 20));

  return {
    playlist,
    cards: ranked.map(({ track, profile, fit, score }) =>
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
        genreProfile: profile,
        playlistFit: fit,
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
