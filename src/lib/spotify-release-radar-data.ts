import "server-only";

import {
  detectGenre,
  detectPlaylistGenre,
  GENRE_LABEL,
  normalizeGenreText,
  type TrackGenre,
} from "@/lib/genre-detection";
import {
  fetchSpotifyAccountPlaylists,
  fetchSpotifyEditablePlaylist,
  withSpotifyToken,
  type SpotifyAccountPlaylist,
  type SpotifyEditablePlaylist,
} from "@/lib/spotify-user";
import type { StatusTone, WorkspaceMetric } from "@/types/workspace";

type SpotifyArtistObject = {
  id?: string;
  name?: string;
  genres?: string[];
  popularity?: number;
  images?: Array<{ url?: string }>;
  external_urls?: { spotify?: string };
};

type SpotifyTrackObject = {
  id?: string;
  name?: string;
  popularity?: number;
  duration_ms?: number;
  external_urls?: { spotify?: string };
  artists?: Array<{
    id?: string;
    name?: string;
  }>;
  album?: {
    id?: string;
    name?: string;
    images?: Array<{ url?: string }>;
    release_date?: string;
  };
};

type SpotifyTopArtistsResponse = {
  items?: SpotifyArtistObject[];
};

type SpotifyTopTracksResponse = {
  items?: SpotifyTrackObject[];
};

type SpotifyFollowedArtistsResponse = {
  artists?: {
    items?: SpotifyArtistObject[];
    cursors?: { after?: string | null };
  };
};

type SpotifyAlbumObject = {
  id?: string;
  name?: string;
  album_type?: string;
  total_tracks?: number;
  release_date?: string;
  release_date_precision?: string;
  images?: Array<{ url?: string }>;
  external_urls?: { spotify?: string };
};

type SpotifyArtistAlbumsResponse = {
  items?: SpotifyAlbumObject[];
};

type SpotifyAlbumTracksResponse = {
  items?: Array<{
    id?: string;
    name?: string;
    track_number?: number;
    artists?: Array<{
      id?: string;
      name?: string;
    }>;
  }>;
};

type SpotifyTracksBatchResponse = {
  tracks?: Array<SpotifyTrackObject | null>;
};

type AccountPlaylistTarget = {
  id: string;
  name: string;
  genre: TrackGenre;
  trackIds: Set<string>;
  artistNames: Set<string>;
  genreCounts: Map<TrackGenre, number>;
};

type AccountPlaylistProfile = {
  playlistsCount: number;
  uniqueTrackCount: number;
  dominantGenre: TrackGenre | null;
  dominantGenreLabel: string | null;
  dominantArtists: string[];
  trackPlaylistNamesById: Map<string, string[]>;
  artistPlaylistCountByName: Map<string, number>;
  genreTrackCountByType: Map<TrackGenre, number>;
  playlistTargets: AccountPlaylistTarget[];
};

type ListeningArtist = {
  id: string;
  name: string;
  imageUrl: string | null;
  spotifyUrl: string;
  popularity: number;
  genres: string[];
  isFollowed: boolean;
  topArtistRank: number | null;
  topTrackAppearances: number;
  affinityScore: number;
};

type ListeningTrack = {
  id: string;
  name: string;
  artists: string;
  artistIds: string[];
  popularity: number;
  albumName: string;
  coverUrl: string | null;
  spotifyUrl: string;
  inPlaylistNames: string[];
};

type ReleaseCandidate = {
  id: string;
  artistId: string;
  artistName: string;
  releaseId: string;
  releaseName: string;
  releaseType: string;
  releaseDate: string | null;
  releaseDateLabel: string;
  freshnessLabel: string;
  coverUrl: string | null;
  spotifyUrl: string;
  name: string;
  artists: string;
  artistIds: string[];
  popularity: number;
  genreLabel: string;
  alreadyInPlaylists: boolean;
  playlistNames: string[];
  suggestedPlaylistName: string | null;
  fitLabel: string;
  fitTone: StatusTone;
  accountArtistCount: number;
  score: number;
  signals: string[];
  reason: string;
};

export type SpotifyReleaseRadarArtist = {
  id: string;
  name: string;
  imageUrl: string | null;
  spotifyUrl: string;
  popularity: number;
  genres: string[];
  affinityLabel: string;
  sources: string[];
};

export type SpotifyReleaseRadarTrack = {
  id: string;
  name: string;
  artists: string;
  coverUrl: string | null;
  spotifyUrl: string;
  popularity: number;
  playlistNames: string[];
};

export type SpotifyReleaseRadarRelease = {
  id: string;
  artistName: string;
  title: string;
  typeLabel: string;
  coverUrl: string | null;
  spotifyUrl: string;
  releaseDateLabel: string;
  freshnessLabel: string;
  totalTracks: number;
  tracksOutsidePlaylists: number;
  bestOpportunityName: string | null;
  signals: string[];
};

export type SpotifyReleaseRadarOpportunity = {
  id: string;
  spotifyTrackId: string;
  name: string;
  artists: string;
  coverUrl: string | null;
  spotifyUrl: string;
  popularity: number;
  releaseName: string;
  releaseDateLabel: string;
  freshnessLabel: string;
  genreLabel: string;
  scoreLabel: string;
  fitLabel: string;
  fitTone: StatusTone;
  signals: string[];
  playlistNames: string[];
  suggestedPlaylistName: string | null;
  reason: string;
};

export type SpotifyReleaseRadarPageData = {
  connected: boolean;
  needsReconnect: boolean;
  message: string | null;
  metrics: WorkspaceMetric[];
  accountSummary: {
    playlistCount: number;
    trackCount: number;
    dominantGenreLabel: string | null;
    dominantArtists: string[];
    followedArtistsCount: number;
  };
  topArtists: SpotifyReleaseRadarArtist[];
  topTracks: SpotifyReleaseRadarTrack[];
  releases: SpotifyReleaseRadarRelease[];
  opportunities: SpotifyReleaseRadarOpportunity[];
};

const MAX_FOLLOWED_ARTISTS = 80;
const MAX_PRIORITY_ARTISTS = 12;
const MAX_RELEASES = 18;
const FRESH_RELEASE_WINDOW_DAYS = 120;

const KNOWN_TRACK_GENRES = new Set<TrackGenre>([
  "funk",
  "trap",
  "rap",
  "sertanejo",
  "pagode",
  "pagodao",
  "piseiro",
  "pop",
  "rock",
  "reggae",
  "unknown",
]);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function normalizeArtistName(value: string) {
  return normalizeGenreText(value).replace(/\s+/g, " ").trim();
}

function extractArtistNames(value: string) {
  return value
    .split(/,| feat\. | feat | ft\. | ft | part\./i)
    .map((artist) => normalizeArtistName(artist))
    .filter(Boolean);
}

function resolveTrackGenre(
  genreLabel: string | null | undefined,
  artists: string,
  trackName: string,
): TrackGenre {
  const normalizedGenre = normalizeGenreText(genreLabel ?? "");

  if (KNOWN_TRACK_GENRES.has(normalizedGenre as TrackGenre)) {
    return normalizedGenre as TrackGenre;
  }

  if (normalizedGenre === "forro") {
    return "piseiro";
  }

  if (normalizedGenre === "samba") {
    return "pagode";
  }

  return detectGenre(artists, trackName);
}

function pickTopGenre(genreCounts: Map<TrackGenre, number>) {
  return [...genreCounts.entries()]
    .filter(([genre]) => genre !== "unknown")
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function getGenreDisplayLabel(genre: TrackGenre | null) {
  if (!genre || genre === "unknown") {
    return null;
  }

  return GENRE_LABEL[genre];
}

function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  iteratee: (item: TItem, index: number) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const workers = Array.from({
    length: Math.min(concurrency, items.length),
  }).map(async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex);
    }
  });

  return Promise.all(workers).then(() => results);
}

function formatReleaseDate(value: string | null) {
  if (!value) {
    return "Sem data";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function getDaysSinceRelease(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function formatFreshnessLabel(value: string | null) {
  const days = getDaysSinceRelease(value);

  if (days === null) {
    return "Sem janela";
  }

  if (days === 0) {
    return "Saiu hoje";
  }

  if (days === 1) {
    return "Saiu ontem";
  }

  if (days <= 7) {
    return `${days} dias`;
  }

  if (days <= 30) {
    return `${Math.ceil(days / 7)} semanas`;
  }

  return `${Math.ceil(days / 30)} meses`;
}

function getReleaseTypeLabel(value: string | undefined) {
  if (value === "single") {
    return "Single";
  }

  if (value === "album") {
    return "Album";
  }

  return "Release";
}

function inferTargetPlaylistName({
  accountProfile,
  trackId,
  artistNames,
  genre,
}: {
  accountProfile: AccountPlaylistProfile;
  trackId: string;
  artistNames: string[];
  genre: TrackGenre;
}) {
  let bestMatch: { name: string; score: number } | null = null;

  for (const playlist of accountProfile.playlistTargets) {
    if (playlist.trackIds.has(trackId)) {
      continue;
    }

    let score = 0;

    if (genre !== "unknown") {
      if (playlist.genre === genre) {
        score += 28;
      } else {
        score += Math.min((playlist.genreCounts.get(genre) ?? 0) * 4, 20);
      }
    }

    const matchingArtists = artistNames.filter((artist) =>
      playlist.artistNames.has(artist),
    ).length;

    score += matchingArtists * 12;

    if (score >= 18 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        name: playlist.name,
        score,
      };
    }
  }

  return bestMatch?.name ?? null;
}

async function spotifyFetch<T>(
  accessToken: string,
  url: string,
  insufficientScopeMessage?: string,
) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      message?: string;
    };

    if (response.status === 403 && insufficientScopeMessage) {
      throw new Error(insufficientScopeMessage);
    }

    throw new Error(
      payload.error?.message?.trim() ||
        payload.message?.trim() ||
        `Spotify request failed (${response.status}).`,
    );
  }

  return (await response.json()) as T;
}

async function fetchTopArtists(accessToken: string) {
  const payload = await spotifyFetch<SpotifyTopArtistsResponse>(
    accessToken,
    "https://api.spotify.com/v1/me/top/artists?limit=12&time_range=medium_term",
    "Reconecte o Spotify para liberar leitura de top artistas e artistas seguidos.",
  );

  return (payload.items ?? [])
    .map((artist, index) => {
      if (!artist.id || !artist.name) {
        return null;
      }

      return {
        id: artist.id,
        name: artist.name,
        imageUrl: artist.images?.[0]?.url?.trim() || null,
        spotifyUrl:
          artist.external_urls?.spotify || `https://open.spotify.com/artist/${artist.id}`,
        popularity:
          typeof artist.popularity === "number" ? artist.popularity : 0,
        genres: artist.genres ?? [],
        rank: index + 1,
      };
    })
    .filter((artist): artist is NonNullable<typeof artist> => Boolean(artist));
}

async function fetchTopTracks(accessToken: string) {
  const payload = await spotifyFetch<SpotifyTopTracksResponse>(
    accessToken,
    "https://api.spotify.com/v1/me/top/tracks?limit=12&time_range=medium_term",
    "Reconecte o Spotify para liberar leitura de top faixas e top artistas.",
  );

  return (payload.items ?? [])
    .map((track) => {
      if (!track.id || !track.name) {
        return null;
      }

      const artists = (track.artists ?? [])
        .map((artist) => artist.name?.trim() || "")
        .filter(Boolean);
      const artistIds = (track.artists ?? [])
        .map((artist) => artist.id?.trim() || "")
        .filter(Boolean);

      return {
        id: track.id,
        name: track.name,
        artists: artists.join(", "),
        artistIds,
        popularity:
          typeof track.popularity === "number" ? track.popularity : 0,
        albumName: track.album?.name?.trim() || "Album nao informado",
        coverUrl: track.album?.images?.[0]?.url?.trim() || null,
        spotifyUrl:
          track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
      };
    })
    .filter((track): track is NonNullable<typeof track> => Boolean(track));
}

async function fetchFollowedArtists(accessToken: string) {
  const artists: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    spotifyUrl: string;
    popularity: number;
    genres: string[];
  }> = [];
  let after: string | null = null;

  while (artists.length < MAX_FOLLOWED_ARTISTS) {
    const url = new URL("https://api.spotify.com/v1/me/following");
    url.searchParams.set("type", "artist");
    url.searchParams.set("limit", "50");

    if (after) {
      url.searchParams.set("after", after);
    }

    const payload = await spotifyFetch<SpotifyFollowedArtistsResponse>(
      accessToken,
      url.toString(),
      "Reconecte o Spotify para liberar leitura dos artistas seguidos.",
    );
    const batch = payload.artists?.items ?? [];

    if (batch.length === 0) {
      break;
    }

    for (const artist of batch) {
      if (!artist.id || !artist.name) {
        continue;
      }

      artists.push({
        id: artist.id,
        name: artist.name,
        imageUrl: artist.images?.[0]?.url?.trim() || null,
        spotifyUrl:
          artist.external_urls?.spotify || `https://open.spotify.com/artist/${artist.id}`,
        popularity:
          typeof artist.popularity === "number" ? artist.popularity : 0,
        genres: artist.genres ?? [],
      });

      if (artists.length >= MAX_FOLLOWED_ARTISTS) {
        break;
      }
    }

    after = payload.artists?.cursors?.after ?? null;

    if (!after) {
      break;
    }
  }

  return artists;
}

function buildPriorityArtists({
  topArtists,
  topTracks,
  followedArtists,
}: {
  topArtists: Awaited<ReturnType<typeof fetchTopArtists>>;
  topTracks: Awaited<ReturnType<typeof fetchTopTracks>>;
  followedArtists: Awaited<ReturnType<typeof fetchFollowedArtists>>;
}) {
  const byId = new Map<string, ListeningArtist>();

  for (const artist of followedArtists) {
    byId.set(artist.id, {
      ...artist,
      isFollowed: true,
      topArtistRank: null,
      topTrackAppearances: 0,
      affinityScore: 0,
    });
  }

  for (const artist of topArtists) {
    const current = byId.get(artist.id);

    byId.set(artist.id, {
      id: artist.id,
      name: artist.name,
      imageUrl: artist.imageUrl,
      spotifyUrl: artist.spotifyUrl,
      popularity: artist.popularity,
      genres: current?.genres.length ? current.genres : artist.genres,
      isFollowed: current?.isFollowed ?? false,
      topArtistRank: artist.rank,
      topTrackAppearances: current?.topTrackAppearances ?? 0,
      affinityScore: 0,
    });
  }

  for (const track of topTracks) {
    track.artistIds.forEach((artistId) => {
      const current = byId.get(artistId);

      if (!current) {
        return;
      }

      current.topTrackAppearances += 1;
    });
  }

  return [...byId.values()]
    .map((artist) => {
      const topArtistBoost = artist.topArtistRank
        ? Math.max(0, 24 - artist.topArtistRank)
        : 0;
      const followedBoost = artist.isFollowed ? 38 : 0;
      const topTrackBoost = artist.topTrackAppearances * 9;

      return {
        ...artist,
        affinityScore: followedBoost + topArtistBoost + topTrackBoost,
      };
    })
    .sort((left, right) => right.affinityScore - left.affinityScore)
    .slice(0, MAX_PRIORITY_ARTISTS);
}

async function fetchArtistLatestReleases(
  accessToken: string,
  artist: ListeningArtist,
) {
  const payload = await spotifyFetch<SpotifyArtistAlbumsResponse>(
    accessToken,
    `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album,single&market=BR&limit=8`,
  );
  const deduped = new Map<string, SpotifyAlbumObject>();

  for (const album of payload.items ?? []) {
    if (!album.id || !album.name) {
      continue;
    }

    const key = `${normalizeGenreText(album.name)}|${album.release_date ?? ""}`;

    if (!deduped.has(key)) {
      deduped.set(key, album);
    }
  }

  const orderedReleases = [...deduped.values()].sort((left, right) => {
    const leftTime = left.release_date ? new Date(left.release_date).getTime() : 0;
    const rightTime = right.release_date ? new Date(right.release_date).getTime() : 0;

    return rightTime - leftTime;
  });
  const freshReleases = orderedReleases.filter((release) => {
    const days = getDaysSinceRelease(release.release_date ?? null);

    return days !== null && days <= FRESH_RELEASE_WINDOW_DAYS;
  });
  const selected = (freshReleases.length > 0 ? freshReleases : orderedReleases)
    .slice(0, freshReleases.length > 1 ? 2 : 1)
    .map((release) => ({
      artistId: artist.id,
      artistName: artist.name,
      artistSignals: buildArtistSources(artist),
      artistAffinityScore: artist.affinityScore,
      id: release.id!,
      name: release.name!,
      type: release.album_type ?? "release",
      totalTracks:
        typeof release.total_tracks === "number" ? release.total_tracks : 0,
      releaseDate: release.release_date ?? null,
      releaseDateLabel: formatReleaseDate(release.release_date ?? null),
      freshnessLabel: formatFreshnessLabel(release.release_date ?? null),
      coverUrl: release.images?.[0]?.url?.trim() || artist.imageUrl,
      spotifyUrl:
        release.external_urls?.spotify ||
        `https://open.spotify.com/album/${release.id}`,
    }));

  return selected;
}

async function fetchAlbumTrackIds(accessToken: string, albumId: string) {
  const payload = await spotifyFetch<SpotifyAlbumTracksResponse>(
    accessToken,
    `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`,
  );

  return (payload.items ?? [])
    .map((track) => track.id?.trim() || "")
    .filter(Boolean);
}

async function fetchTracksByIds(accessToken: string, trackIds: string[]) {
  const batches = [];

  for (let index = 0; index < trackIds.length; index += 50) {
    batches.push(trackIds.slice(index, index + 50));
  }

  const tracks = await mapWithConcurrency(batches, 3, async (batch) => {
    const payload = await spotifyFetch<SpotifyTracksBatchResponse>(
      accessToken,
      `https://api.spotify.com/v1/tracks?ids=${batch.join(",")}&market=BR`,
    );

    return (payload.tracks ?? []).filter(
      (track): track is SpotifyTrackObject => Boolean(track?.id && track.name),
    );
  });

  return tracks.flat();
}

function buildArtistSources(artist: ListeningArtist) {
  const sources = [];

  if (artist.isFollowed) {
    sources.push("Artista seguido");
  }

  if (artist.topArtistRank) {
    sources.push(`Top artist #${artist.topArtistRank}`);
  }

  if (artist.topTrackAppearances > 0) {
    sources.push(`${artist.topTrackAppearances} top faixas`);
  }

  return sources;
}

async function buildAccountPlaylistProfile(playlists: SpotifyAccountPlaylist[]) {
  if (playlists.length === 0) {
    return null;
  }

  const editablePlaylists = await mapWithConcurrency(
    playlists,
    2,
    async (playlist) => {
      const { result } = await fetchSpotifyEditablePlaylist(playlist.id);

      if (!result.connected || !result.playlist) {
        return null;
      }

      return result.playlist;
    },
  );

  return mapEditablePlaylistsToProfile(
    editablePlaylists.filter(
      (playlist): playlist is SpotifyEditablePlaylist => Boolean(playlist),
    ),
  );
}

function mapEditablePlaylistsToProfile(playlists: SpotifyEditablePlaylist[]) {
  if (playlists.length === 0) {
    return null;
  }

  const trackPlaylistNamesById = new Map<string, string[]>();
  const artistPlaylistCountByName = new Map<string, number>();
  const genreTrackCountByType = new Map<TrackGenre, number>();
  const playlistTargets: AccountPlaylistTarget[] = [];

  for (const playlist of playlists) {
    const playlistTrackIds = new Set<string>();
    const playlistArtistNames = new Set<string>();
    const playlistGenreCounts = new Map<TrackGenre, number>();

    for (const track of playlist.tracks) {
      if (!track.id || playlistTrackIds.has(track.id)) {
        continue;
      }

      playlistTrackIds.add(track.id);
      const trackPlaylists = trackPlaylistNamesById.get(track.id) ?? [];

      if (!trackPlaylists.includes(playlist.name)) {
        trackPlaylists.push(playlist.name);
      }

      trackPlaylistNamesById.set(track.id, trackPlaylists);

      const detectedGenre = resolveTrackGenre(null, track.artists, track.name);

      if (detectedGenre !== "unknown") {
        genreTrackCountByType.set(
          detectedGenre,
          (genreTrackCountByType.get(detectedGenre) ?? 0) + 1,
        );
        playlistGenreCounts.set(
          detectedGenre,
          (playlistGenreCounts.get(detectedGenre) ?? 0) + 1,
        );
      }

      for (const artistName of extractArtistNames(track.artists)) {
        playlistArtistNames.add(artistName);
      }
    }

    for (const artistName of playlistArtistNames) {
      artistPlaylistCountByName.set(
        artistName,
        (artistPlaylistCountByName.get(artistName) ?? 0) + 1,
      );
    }

    const playlistGenre =
      detectPlaylistGenre(playlist.name, playlist.description) !== "unknown"
        ? detectPlaylistGenre(playlist.name, playlist.description)
        : pickTopGenre(playlistGenreCounts) ?? "unknown";

    playlistTargets.push({
      id: playlist.id,
      name: playlist.name,
      genre: playlistGenre,
      trackIds: playlistTrackIds,
      artistNames: playlistArtistNames,
      genreCounts: playlistGenreCounts,
    });
  }

  const dominantGenre = pickTopGenre(genreTrackCountByType);

  return {
    playlistsCount: playlistTargets.length,
    uniqueTrackCount: trackPlaylistNamesById.size,
    dominantGenre,
    dominantGenreLabel: getGenreDisplayLabel(dominantGenre),
    dominantArtists: [...artistPlaylistCountByName.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([artistName]) => artistName),
    trackPlaylistNamesById,
    artistPlaylistCountByName,
    genreTrackCountByType,
    playlistTargets,
  } satisfies AccountPlaylistProfile;
}

function buildFitSummary({
  accountProfile,
  trackId,
  artists,
  trackName,
}: {
  accountProfile: AccountPlaylistProfile | null;
  trackId: string;
  artists: string;
  trackName: string;
}): {
  playlistNames: string[];
  alreadyInPlaylists: boolean;
  suggestedPlaylistName: string | null;
  accountArtistCount: number;
  fitLabel: string;
  fitTone: StatusTone;
} {
  if (!accountProfile) {
    return {
      playlistNames: [],
      alreadyInPlaylists: false,
      suggestedPlaylistName: null,
      accountArtistCount: 0,
      fitLabel: "Base em branco",
      fitTone: "slate",
    };
  }

  const playlistNames = accountProfile.trackPlaylistNamesById.get(trackId) ?? [];
  const artistNames = extractArtistNames(artists);
  const accountArtistCount = Math.max(
    0,
    ...artistNames.map(
      (artistName) => accountProfile.artistPlaylistCountByName.get(artistName) ?? 0,
    ),
  );
  const genre = resolveTrackGenre(null, artists, trackName);
  const genreStrength =
    genre === "unknown"
      ? 0
      : accountProfile.genreTrackCountByType.get(genre) ?? 0;
  const suggestedPlaylistName =
    playlistNames.length > 0
      ? null
      : inferTargetPlaylistName({
          accountProfile,
          trackId,
          artistNames,
          genre,
        });
  const fitSignal =
    playlistNames.length * 18 +
    accountArtistCount * 5 +
    Math.min(genreStrength, 12) +
    (suggestedPlaylistName ? 10 : 0);

  if (playlistNames.length >= 1 || fitSignal >= 30) {
    return {
      playlistNames,
      alreadyInPlaylists: playlistNames.length > 0,
      suggestedPlaylistName,
      accountArtistCount,
      fitLabel: playlistNames.length > 0 ? "Ja na base" : "Fit alto",
      fitTone: "green",
    };
  }

  if (accountArtistCount > 0 || genreStrength >= 4 || suggestedPlaylistName) {
    return {
      playlistNames,
      alreadyInPlaylists: false,
      suggestedPlaylistName,
      accountArtistCount,
      fitLabel: "Fit medio",
      fitTone: "yellow",
    };
  }

  return {
    playlistNames,
    alreadyInPlaylists: false,
    suggestedPlaylistName,
    accountArtistCount,
    fitLabel: "Fit baixo",
    fitTone: "slate",
  };
}

function buildReason({
  artist,
  fitLabel,
  suggestedPlaylistName,
  alreadyInPlaylists,
}: {
  artist: ListeningArtist;
  fitLabel: string;
  suggestedPlaylistName: string | null;
  alreadyInPlaylists: boolean;
}) {
  const sources = buildArtistSources(artist);
  const sourceCopy = sources.length > 0 ? sources.join(" + ").toLowerCase() : "sem sinal forte";

  if (alreadyInPlaylists) {
    return `Saiu de um artista com ${sourceCopy} e ja entrou na sua base, entao vale decidir reforco ou reposicionamento.`;
  }

  if (suggestedPlaylistName) {
    return `Saiu de um artista com ${sourceCopy} e aponta encaixe direto para ${suggestedPlaylistName}, com leitura ${fitLabel.toLowerCase()}.`;
  }

  return `Saiu de um artista com ${sourceCopy} e ainda nao apareceu nas suas playlists, entao entra como oportunidade de descoberta.`;
}

export async function getSpotifyReleaseRadarPageData(): Promise<SpotifyReleaseRadarPageData> {
  const { result } = await fetchSpotifyAccountPlaylists();

  if (!result.connected) {
    return {
      connected: false,
      needsReconnect: false,
      message: result.message,
      metrics: [
        {
          title: "Conta Spotify",
          value: "Desconectada",
          helper: "Conecte para ler artistas, escuta e playlists",
          tone: "red",
        },
      ],
      accountSummary: {
        playlistCount: 0,
        trackCount: 0,
        dominantGenreLabel: null,
        dominantArtists: [],
        followedArtistsCount: 0,
      },
      topArtists: [],
      topTracks: [],
      releases: [],
      opportunities: [],
    };
  }

  try {
    const accountProfilePromise = buildAccountPlaylistProfile(result.playlists);
    const spotifyProfile = await withSpotifyToken(async (accessToken) => {
      const [topArtists, topTracks, followedArtists] = await Promise.all([
        fetchTopArtists(accessToken),
        fetchTopTracks(accessToken),
        fetchFollowedArtists(accessToken),
      ]);
      const priorityArtists = buildPriorityArtists({
        topArtists,
        topTracks,
        followedArtists,
      });
      const releases = (
        await mapWithConcurrency(priorityArtists, 3, async (artist) =>
          fetchArtistLatestReleases(accessToken, artist),
        )
      )
        .flat()
        .sort((left, right) => {
          const dateDiff =
            (right.releaseDate ? new Date(right.releaseDate).getTime() : 0) -
            (left.releaseDate ? new Date(left.releaseDate).getTime() : 0);

          if (dateDiff !== 0) {
            return dateDiff;
          }

          return right.artistAffinityScore - left.artistAffinityScore;
        })
        .slice(0, MAX_RELEASES);

      const trackIdsByRelease = new Map<string, string[]>();

      await mapWithConcurrency(releases, 3, async (release) => {
        trackIdsByRelease.set(
          release.id,
          await fetchAlbumTrackIds(accessToken, release.id),
        );
      });

      const trackIds = [...new Set([...trackIdsByRelease.values()].flat())];
      const trackDetails = await fetchTracksByIds(accessToken, trackIds);

      return {
        topArtists,
        topTracks,
        followedArtists,
        priorityArtists,
        releases,
        trackIdsByRelease,
        trackDetails,
      };
    });
    const accountProfile = await accountProfilePromise;
    const priorityArtistById = new Map(
      spotifyProfile.data.priorityArtists.map((artist) => [artist.id, artist]),
    );
    const releaseByTrackId = new Map<string, (typeof spotifyProfile.data.releases)[number]>();

    for (const release of spotifyProfile.data.releases) {
      const releaseTrackIds = spotifyProfile.data.trackIdsByRelease.get(release.id) ?? [];

      for (const trackId of releaseTrackIds) {
        releaseByTrackId.set(trackId, release);
      }
    }

    const topTracks: SpotifyReleaseRadarTrack[] = spotifyProfile.data.topTracks.map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists,
      coverUrl: track.coverUrl,
      spotifyUrl: track.spotifyUrl,
      popularity: track.popularity,
      playlistNames: accountProfile?.trackPlaylistNamesById.get(track.id) ?? [],
    }));
    const topArtists: SpotifyReleaseRadarArtist[] = spotifyProfile.data.priorityArtists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      imageUrl: artist.imageUrl,
      spotifyUrl: artist.spotifyUrl,
      popularity: artist.popularity,
      genres: artist.genres,
      affinityLabel: `${artist.affinityScore} pts`,
      sources: buildArtistSources(artist),
    }));

    const candidateRows = spotifyProfile.data.trackDetails
      .map<ReleaseCandidate | null>((track) => {
        if (!track.id || !track.name) {
          return null;
        }

        const release = releaseByTrackId.get(track.id);

        if (!release) {
          return null;
        }

        const priorityArtist = priorityArtistById.get(release.artistId);

        if (!priorityArtist) {
          return null;
        }

        const artists = (track.artists ?? [])
          .map((artist) => artist.name?.trim() || "")
          .filter(Boolean);
        const artistIds = (track.artists ?? [])
          .map((artist) => artist.id?.trim() || "")
          .filter(Boolean);
        const artistsLabel = artists.join(", ");
        const fit = buildFitSummary({
          accountProfile,
          trackId: track.id,
          artists: artistsLabel,
          trackName: track.name,
        });
        const releaseDays = getDaysSinceRelease(release.releaseDate);
        const releaseBoost =
          releaseDays === null ? 0 : clamp(32 - releaseDays * 0.42, 4, 32);
        const gapBoost = fit.alreadyInPlaylists ? -14 : 18;
        const popularityBoost =
          typeof track.popularity === "number" ? track.popularity * 0.28 : 0;
        const affinityBoost = priorityArtist.affinityScore * 0.45;
        const playlistBoost = fit.suggestedPlaylistName ? 12 : 0;
        const score = clamp(
          Math.round(
            releaseBoost +
              gapBoost +
              popularityBoost +
              affinityBoost +
              playlistBoost +
              fit.accountArtistCount * 4,
          ),
          0,
          100,
        );
        const genre = resolveTrackGenre(
          null,
          artistsLabel,
          track.name,
        );
        const genreLabel = getGenreDisplayLabel(genre) ?? "Radar aberto";

        return {
          id: track.id,
          artistId: release.artistId,
          artistName: release.artistName,
          releaseId: release.id,
          releaseName: release.name,
          releaseType: getReleaseTypeLabel(release.type),
          releaseDate: release.releaseDate,
          releaseDateLabel: release.releaseDateLabel,
          freshnessLabel: release.freshnessLabel,
          coverUrl:
            track.album?.images?.[0]?.url?.trim() || release.coverUrl || null,
          spotifyUrl:
            track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
          name: track.name,
          artists: artistsLabel,
          artistIds,
          popularity:
            typeof track.popularity === "number" ? track.popularity : 0,
          genreLabel,
          alreadyInPlaylists: fit.alreadyInPlaylists,
          playlistNames: fit.playlistNames,
          suggestedPlaylistName: fit.suggestedPlaylistName,
          fitLabel: fit.fitLabel,
          fitTone: fit.fitTone,
          accountArtistCount: fit.accountArtistCount,
          score,
          signals: buildArtistSources(priorityArtist),
          reason: buildReason({
            artist: priorityArtist,
            fitLabel: fit.fitLabel,
            suggestedPlaylistName: fit.suggestedPlaylistName,
            alreadyInPlaylists: fit.alreadyInPlaylists,
          }),
        } satisfies ReleaseCandidate;
      })
      .filter((track): track is ReleaseCandidate => track !== null)
      .sort((left, right) => right.score - left.score);

    const releaseCandidatesById = new Map<string, ReleaseCandidate[]>();

    for (const candidate of candidateRows) {
      const current = releaseCandidatesById.get(candidate.releaseId) ?? [];
      current.push(candidate);
      releaseCandidatesById.set(candidate.releaseId, current);
    }

    const releases: SpotifyReleaseRadarRelease[] = spotifyProfile.data.releases.map((release) => {
      const candidates = releaseCandidatesById.get(release.id) ?? [];
      const outsidePlaylists = candidates.filter((candidate) => !candidate.alreadyInPlaylists);
      const bestOpportunity = [...outsidePlaylists].sort(
        (left, right) => right.score - left.score,
      )[0];

      return {
        id: release.id,
        artistName: release.artistName,
        title: release.name,
        typeLabel: getReleaseTypeLabel(release.type),
        coverUrl: release.coverUrl,
        spotifyUrl: release.spotifyUrl,
        releaseDateLabel: release.releaseDateLabel,
        freshnessLabel: release.freshnessLabel,
        totalTracks: release.totalTracks,
        tracksOutsidePlaylists: outsidePlaylists.length,
        bestOpportunityName: bestOpportunity?.name ?? null,
        signals: release.artistSignals,
      };
    });
    const opportunities: SpotifyReleaseRadarOpportunity[] = candidateRows
      .filter((candidate) => !candidate.alreadyInPlaylists)
      .slice(0, 18)
      .map((candidate) => ({
        id: candidate.id,
        spotifyTrackId: candidate.id,
        name: candidate.name,
        artists: candidate.artists,
        coverUrl: candidate.coverUrl,
        spotifyUrl: candidate.spotifyUrl,
        popularity: candidate.popularity,
        releaseName: candidate.releaseName,
        releaseDateLabel: candidate.releaseDateLabel,
        freshnessLabel: candidate.freshnessLabel,
        genreLabel: candidate.genreLabel,
        scoreLabel: `${candidate.score} pts`,
        fitLabel: candidate.fitLabel,
        fitTone: candidate.fitTone,
        signals: candidate.signals,
        playlistNames: candidate.playlistNames,
        suggestedPlaylistName: candidate.suggestedPlaylistName,
        reason: candidate.reason,
      }));
    const missingOpportunities = opportunities.length;

    return {
      connected: true,
      needsReconnect: false,
      message:
        result.playlists.length === 0
          ? "Conta conectada, mas ainda sem playlists proprias para cruzamento."
          : null,
      metrics: [
        {
          title: "Artistas seguidos",
          value: formatCount(spotifyProfile.data.followedArtists.length),
          helper: "Base de afinidade direta",
          tone: "blue",
        },
        {
          title: "Lançamentos frescos",
          value: formatCount(releases.length),
          helper: "Singles e albums recentes",
          tone: "purple",
        },
        {
          title: "Fora das playlists",
          value: formatCount(missingOpportunities),
          helper: "Oportunidades com gap real",
          tone: "green",
        },
        {
          title: "Base lida",
          value: formatCount(accountProfile?.uniqueTrackCount ?? 0),
          helper:
            accountProfile?.dominantGenreLabel
              ? `${accountProfile.dominantGenreLabel} domina a conta`
              : "Sem genero dominante claro",
          tone: "yellow",
        },
      ],
      accountSummary: {
        playlistCount: accountProfile?.playlistsCount ?? result.playlists.length,
        trackCount: accountProfile?.uniqueTrackCount ?? 0,
        dominantGenreLabel: accountProfile?.dominantGenreLabel ?? null,
        dominantArtists: accountProfile?.dominantArtists ?? [],
        followedArtistsCount: spotifyProfile.data.followedArtists.length,
      },
      topArtists,
      topTracks,
      releases,
      opportunities,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel montar a leitura de novidades do Spotify.";

    return {
      connected: false,
      needsReconnect: /Reconecte o Spotify/i.test(message),
      message,
      metrics: [
        {
          title: "Leitura Spotify",
          value: "Indisponivel",
          helper: message,
          tone: "red",
        },
      ],
      accountSummary: {
        playlistCount: result.playlists.length,
        trackCount: 0,
        dominantGenreLabel: null,
        dominantArtists: [],
        followedArtistsCount: 0,
      },
      topArtists: [],
      topTracks: [],
      releases: [],
      opportunities: [],
    };
  }
}
