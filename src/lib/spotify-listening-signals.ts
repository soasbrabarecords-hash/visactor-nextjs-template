import "server-only";
import type { PlaylistListeningCandidate } from "@/lib/playlist-suggestion-intelligence";
import type { SpotifyOAuthTokenResponse } from "@/lib/spotify-user";
import { withSpotifyToken } from "@/lib/spotify-user";
import {
  getTrackGenreProfiles,
  toTrackGenreCardProfile,
} from "@/lib/track-profile-engine";
import type { TrackGenreProfile } from "@/types/track-profile";

type SpotifyTrackObject = {
  id?: string;
  name?: string;
  duration_ms?: number;
  popularity?: number;
  external_urls?: { spotify?: string };
  artists?: Array<{ id?: string; name?: string }>;
  album?: {
    name?: string;
    images?: Array<{ url?: string }>;
  };
};

type SpotifyTopTracksResponse = {
  items?: SpotifyTrackObject[];
};

type SpotifyTopArtistsResponse = {
  items?: Array<{
    id?: string;
    genres?: string[];
  }>;
};

type SpotifyRecentlyPlayedResponse = {
  items?: Array<{
    track?: SpotifyTrackObject;
    played_at?: string;
  }>;
};

type ListeningRange = "short_term" | "medium_term" | "long_term";

type ListeningAggregate = {
  track: SpotifyTrackObject;
  ranks: Partial<Record<ListeningRange, number>>;
  recentPlayCount: number;
  lastPlayedAt: string | null;
};

export type SpotifyListeningSignals = {
  available: boolean;
  recentHistoryAvailable: boolean;
  candidates: PlaylistListeningCandidate[];
  refreshedToken: SpotifyOAuthTokenResponse | null;
};

const LISTENING_RANGES: ListeningRange[] = [
  "short_term",
  "medium_term",
  "long_term",
];

const RANGE_WEIGHTS: Record<ListeningRange, number> = {
  short_term: 1,
  medium_term: 0.72,
  long_term: 0.5,
};

const RANGE_LABELS: Record<ListeningRange, string> = {
  short_term: "4 semanas",
  medium_term: "6 meses",
  long_term: "1 ano",
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function formatDuration(milliseconds: number | undefined) {
  if (!milliseconds || milliseconds <= 0) return "—";
  const seconds = Math.round(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function spotifyJson<T>(
  accessToken: string,
  url: string,
  { optionalScope = false }: { optionalScope?: boolean } = {},
): Promise<T | null> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (response.status === 403 && optionalScope) return null;

  if (!response.ok) {
    throw new Error(`Spotify listening signals failed (${response.status}).`);
  }

  return (await response.json()) as T;
}

function rankScore(rank: number) {
  return clamp(((51 - rank) / 50) * 100);
}

export function calculateListeningAffinity({
  ranks,
  recentPlayCount,
  lastPlayedAt,
}: {
  ranks: Partial<Record<ListeningRange, number>>;
  recentPlayCount: number;
  lastPlayedAt: string | null;
}) {
  const rankedRanges = LISTENING_RANGES.filter((range) => ranks[range]);
  const rangeWeight = rankedRanges.reduce(
    (total, range) => total + RANGE_WEIGHTS[range],
    0,
  );
  const rankedAffinity =
    rangeWeight > 0
      ? rankedRanges.reduce(
          (total, range) =>
            total + rankScore(ranks[range] as number) * RANGE_WEIGHTS[range],
          0,
        ) / rangeWeight
      : 35;
  const breadthBonus = Math.max(0, rankedRanges.length - 1) * 6;
  const repeatBonus = Math.min(22, recentPlayCount * 7);
  const lastPlayedMs = lastPlayedAt ? new Date(lastPlayedAt).getTime() : 0;
  const hoursSinceLastPlay = lastPlayedMs
    ? Math.max(0, (Date.now() - lastPlayedMs) / 3_600_000)
    : Number.POSITIVE_INFINITY;
  const recencyBonus = Number.isFinite(hoursSinceLastPlay)
    ? Math.max(0, 10 - hoursSinceLastPlay / 12)
    : 0;

  return Math.round(
    clamp(rankedAffinity * 0.78 + breadthBonus + repeatBonus + recencyBonus),
  );
}

function buildListeningSignal(aggregate: ListeningAggregate) {
  const rankedRanges = LISTENING_RANGES.filter(
    (range) => aggregate.ranks[range],
  );

  if (aggregate.recentPlayCount > 1) {
    return `ouvida ${aggregate.recentPlayCount}x nas reproduções recentes`;
  }

  if (aggregate.recentPlayCount === 1 && rankedRanges.length > 0) {
    return `ouvida recentemente + top pessoal em ${RANGE_LABELS[rankedRanges[0]]}`;
  }

  if (rankedRanges.length > 1) {
    return `top pessoal em ${rankedRanges.length} janelas de tempo`;
  }

  if (rankedRanges.length === 1) {
    return `top pessoal em ${RANGE_LABELS[rankedRanges[0]]}`;
  }

  return "ouvida recentemente na conta";
}

function resolveMarket(profile: TrackGenreProfile | undefined) {
  if (
    profile?.countrySignal === "BR" ||
    profile?.languageSignal === "pt-BR" ||
    profile?.primaryGenre === "funk" ||
    profile?.primaryGenre === "sertanejo" ||
    profile?.primaryGenre === "piseiro_forro"
  ) {
    return "BR" as const;
  }

  return "GLOBAL" as const;
}

function trackArtists(track: SpotifyTrackObject) {
  return (track.artists ?? [])
    .map((artist) => artist.name?.trim() || "")
    .filter(Boolean)
    .join(", ");
}

function artistIds(track: SpotifyTrackObject) {
  return (track.artists ?? [])
    .map((artist) => artist.id?.trim() || "")
    .filter(Boolean);
}

export async function getSpotifyListeningSignals(
  workspaceId: string | null | undefined,
): Promise<SpotifyListeningSignals> {
  try {
    const { data, refreshedToken } = await withSpotifyToken(
      async (accessToken) => {
        const [shortTerm, mediumTerm, longTerm, topArtists, recent] =
          await Promise.all([
            spotifyJson<SpotifyTopTracksResponse>(
              accessToken,
              "https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=short_term",
            ),
            spotifyJson<SpotifyTopTracksResponse>(
              accessToken,
              "https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=medium_term",
            ),
            spotifyJson<SpotifyTopTracksResponse>(
              accessToken,
              "https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=long_term",
            ),
            spotifyJson<SpotifyTopArtistsResponse>(
              accessToken,
              "https://api.spotify.com/v1/me/top/artists?limit=50&time_range=medium_term",
            ),
            spotifyJson<SpotifyRecentlyPlayedResponse>(
              accessToken,
              "https://api.spotify.com/v1/me/player/recently-played?limit=50",
              { optionalScope: true },
            ),
          ]);

        return {
          topTracks: {
            short_term: shortTerm?.items ?? [],
            medium_term: mediumTerm?.items ?? [],
            long_term: longTerm?.items ?? [],
          },
          topArtists: topArtists?.items ?? [],
          recent: recent?.items ?? null,
        };
      },
    );
    const aggregates = new Map<string, ListeningAggregate>();

    for (const range of LISTENING_RANGES) {
      data.topTracks[range].forEach((track, index) => {
        if (!track.id || !track.name) return;
        const current = aggregates.get(track.id) ?? {
          track,
          ranks: {},
          recentPlayCount: 0,
          lastPlayedAt: null,
        };
        current.track = track;
        current.ranks[range] = index + 1;
        aggregates.set(track.id, current);
      });
    }

    for (const item of data.recent ?? []) {
      const track = item.track;
      if (!track?.id || !track.name) continue;
      const current = aggregates.get(track.id) ?? {
        track,
        ranks: {},
        recentPlayCount: 0,
        lastPlayedAt: null,
      };
      current.track = track;
      current.recentPlayCount += 1;
      if (
        item.played_at &&
        (!current.lastPlayedAt || item.played_at > current.lastPlayedAt)
      ) {
        current.lastPlayedAt = item.played_at;
      }
      aggregates.set(track.id, current);
    }

    const artistGenres = new Map(
      data.topArtists.flatMap((artist) =>
        artist.id ? [[artist.id, artist.genres ?? []] as const] : [],
      ),
    );
    const rankedAggregates = [...aggregates.values()]
      .map((aggregate) => ({
        aggregate,
        affinity: calculateListeningAffinity(aggregate),
      }))
      .filter(({ affinity }) => affinity >= 35)
      .sort((left, right) => right.affinity - left.affinity)
      .slice(0, 100);
    const profiles = await getTrackGenreProfiles(
      rankedAggregates.map(({ aggregate }) => ({
        spotifyTrackId: aggregate.track.id as string,
        name: aggregate.track.name,
        artists: trackArtists(aggregate.track),
        albumName: aggregate.track.album?.name ?? null,
        artistIds: artistIds(aggregate.track),
        artistGenres: unique(
          artistIds(aggregate.track).flatMap(
            (artistId) => artistGenres.get(artistId) ?? [],
          ),
        ),
      })),
      { workspaceId, persistFallbacks: true },
    );
    const candidates = rankedAggregates.map(({ aggregate, affinity }) => {
      const track = aggregate.track;
      const id = track.id as string;
      const profile = profiles.get(id);

      return {
        id,
        name: track.name as string,
        artists: trackArtists(track) || "Artista não informado",
        albumName: track.album?.name?.trim() || "Álbum não informado",
        imageUrl: track.album?.images?.[0]?.url?.trim() || null,
        durationLabel: formatDuration(track.duration_ms),
        spotifyUrl:
          track.external_urls?.spotify ||
          `https://open.spotify.com/track/${id}`,
        popularity: typeof track.popularity === "number" ? track.popularity : 0,
        market: resolveMarket(profile),
        personalAffinityScore: affinity,
        recentPlayCount: aggregate.recentPlayCount,
        lastPlayedAt: aggregate.lastPlayedAt,
        listeningSignal: buildListeningSignal(aggregate),
        genreProfile: toTrackGenreCardProfile(profile),
      } satisfies PlaylistListeningCandidate;
    });

    return {
      available: candidates.length > 0,
      recentHistoryAvailable: data.recent !== null,
      candidates,
      refreshedToken,
    };
  } catch (error) {
    process.stderr.write(
      `[spotify:listening-signals] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return {
      available: false,
      recentHistoryAvailable: false,
      candidates: [],
      refreshedToken: null,
    };
  }
}
