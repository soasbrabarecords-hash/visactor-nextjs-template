import "server-only";
import {
  fetchSpotifyEditablePlaylist,
  withSpotifyToken,
} from "@/lib/spotify-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  classifyTrackGenre,
  confidenceLabel,
  createGenreEvidence,
} from "@/lib/track-genre-taxonomy";
import type {
  MusicIntelligenceMarketQueue,
  MusicIntelligenceResponse,
  MusicIntelligenceTrack,
} from "@/types/music-intelligence";
import type {
  PlaylistGenreProfile,
  TrackGenreEvidence,
  TrackGenreProfile,
  TrackGenreSource,
  TrackProfileGenre,
  TrackProfileInput,
} from "@/types/track-profile";

type TrackProfileRow = {
  spotify_track_id: string;
  spotify_artist_ids: string[] | null;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  isrc: string | null;
  primary_genre: TrackProfileGenre;
  secondary_genres: TrackProfileGenre[] | null;
  subgenres: string[] | null;
  mood_tags: string[] | null;
  energy_tags: string[] | null;
  language_signal: string;
  country_signal: string;
  genre_confidence: number;
  genre_sources: TrackGenreSource[] | null;
  genre_evidence: TrackGenreEvidence[] | null;
  last_enriched_at: string;
};

type GenreOverrideRow = {
  entity_type: "track" | "artist";
  entity_id: string;
  primary_genre: TrackProfileGenre;
  secondary_genres: TrackProfileGenre[] | null;
  subgenres: string[] | null;
  mood_tags: string[] | null;
  energy_tags: string[] | null;
  language_signal: string | null;
  country_signal: string | null;
  note: string | null;
  updated_at: string;
};

type SpotifyTrackPayload = {
  id?: string;
  name?: string;
  external_ids?: { isrc?: string };
  artists?: Array<{ id?: string; name?: string }>;
  album?: { name?: string };
};

type SpotifyArtistPayload = {
  id?: string;
  name?: string;
  genres?: string[];
};

type MusicBrainzTag = { name?: string; count?: number };
type MusicBrainzGenre = { name?: string; count?: number };
type MusicBrainzRecording = {
  id?: string;
  title?: string;
  tags?: MusicBrainzTag[];
  genres?: MusicBrainzGenre[];
  "artist-credit"?: Array<{
    artist?: {
      id?: string;
      name?: string;
      tags?: MusicBrainzTag[];
      genres?: MusicBrainzGenre[];
    };
  }>;
};

type MusicBrainzPayload = {
  recordings?: MusicBrainzRecording[];
};

type LastFmPayload = {
  toptags?: {
    tag?: Array<{ name?: string; count?: number }>;
  };
  error?: number;
  message?: string;
};

export type SaveGenreOverrideInput = {
  workspaceId: string;
  userId: string;
  entityType: "track" | "artist";
  entityId: string;
  primaryGenre: TrackProfileGenre;
  secondaryGenres?: TrackProfileGenre[];
  subgenres?: string[];
  moodTags?: string[];
  energyTags?: string[];
  languageSignal?: string | null;
  countrySignal?: string | null;
  note?: string | null;
};

const PROFILE_SELECT =
  "spotify_track_id,spotify_artist_ids,track_name,artist_name,album_name,isrc,primary_genre,secondary_genres,subgenres,mood_tags,energy_tags,language_signal,country_signal,genre_confidence,genre_sources,genre_evidence,last_enriched_at";
const OVERRIDE_SELECT =
  "entity_type,entity_id,primary_genre,secondary_genres,subgenres,mood_tags,energy_tags,language_signal,country_signal,note,updated_at";
const MUSICBRAINZ_BASE_URL = "https://musicbrainz.org/ws/2";
const LASTFM_BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const MUSICBRAINZ_MIN_INTERVAL_MS = 1100;
const EXTERNAL_TIMEOUT_MS = 7000;
const PROFILE_BATCH_SIZE = 100;

let musicBrainzQueue: Promise<unknown> = Promise.resolve();
let musicBrainzNextRequestAt = 0;

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanList(values: unknown, max = 20) {
  if (!Array.isArray(values)) return [];
  return unique(
    values.map((value) => cleanText(value, 80)).filter(Boolean),
  ).slice(0, max);
}

function musicBrainzUserAgent() {
  return (
    process.env.MUSICBRAINZ_USER_AGENT?.trim() ||
    "SoAsBraba-MusicIntelligence/1.0 (contato@soasbraba.com)"
  );
}

async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`External metadata error ${response.status}.`);
  }
  return (await response.json()) as T;
}

async function fetchMusicBrainzJson<T>(url: string): Promise<T> {
  const task = musicBrainzQueue.then(async () => {
    const wait = Math.max(0, musicBrainzNextRequestAt - Date.now());
    if (wait > 0) await sleep(wait);
    try {
      return await fetchJson<T>(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": musicBrainzUserAgent(),
        },
      });
    } finally {
      musicBrainzNextRequestAt = Date.now() + MUSICBRAINZ_MIN_INTERVAL_MS;
    }
  });
  musicBrainzQueue = task.catch(() => undefined);
  return task;
}

function source(
  id: TrackGenreSource["id"],
  label: string,
  status: TrackGenreSource["status"],
): TrackGenreSource {
  return { id, label, status };
}

function profileFromRow(row: TrackProfileRow): TrackGenreProfile {
  return {
    spotifyTrackId: row.spotify_track_id,
    spotifyArtistIds: row.spotify_artist_ids ?? [],
    trackName: row.track_name,
    artistName: row.artist_name,
    albumName: row.album_name,
    isrc: row.isrc,
    primaryGenre: row.primary_genre,
    secondaryGenres: row.secondary_genres ?? [],
    subgenres: row.subgenres ?? [],
    moodTags: row.mood_tags ?? [],
    energyTags: row.energy_tags ?? [],
    languageSignal: row.language_signal,
    countrySignal: row.country_signal,
    genreConfidence: row.genre_confidence,
    confidenceLabel: confidenceLabel(row.genre_confidence),
    genreSources: row.genre_sources ?? [],
    genreEvidence: row.genre_evidence ?? [],
    lastEnrichedAt: row.last_enriched_at,
    manualOverride: false,
    manualOverrideEntityType: null,
  };
}

function profileToRow(profile: TrackGenreProfile) {
  const timestamp = new Date().toISOString();
  return {
    spotify_track_id: profile.spotifyTrackId,
    spotify_artist_ids: profile.spotifyArtistIds,
    track_name: profile.trackName,
    artist_name: profile.artistName,
    album_name: profile.albumName,
    isrc: profile.isrc,
    primary_genre: profile.primaryGenre,
    secondary_genres: profile.secondaryGenres,
    subgenres: profile.subgenres,
    mood_tags: profile.moodTags,
    energy_tags: profile.energyTags,
    language_signal: profile.languageSignal,
    country_signal: profile.countrySignal,
    genre_confidence: profile.genreConfidence,
    genre_sources: profile.genreSources,
    genre_evidence: profile.genreEvidence,
    enrichment_version: "v1",
    last_enriched_at: profile.lastEnrichedAt,
    updated_at: timestamp,
  };
}

function applyOverride(
  profile: TrackGenreProfile,
  override: GenreOverrideRow | undefined,
): TrackGenreProfile {
  if (!override) return profile;
  const manualEvidence: TrackGenreEvidence = {
    source: "manual_override",
    genres: [override.primary_genre],
    tags: [override.primary_genre, ...(override.subgenres ?? [])],
    detail:
      override.note?.trim() ||
      `Correção manual aplicada ao ${override.entity_type === "track" ? "track" : "artista"}.`,
    weight: 1000,
    external: false,
  };

  return {
    ...profile,
    primaryGenre: override.primary_genre,
    secondaryGenres: override.secondary_genres ?? [],
    subgenres: override.subgenres ?? [],
    moodTags: override.mood_tags?.length
      ? override.mood_tags
      : profile.moodTags,
    energyTags: override.energy_tags?.length
      ? override.energy_tags
      : profile.energyTags,
    languageSignal: override.language_signal || profile.languageSignal,
    countrySignal: override.country_signal || profile.countrySignal,
    genreConfidence: 100,
    confidenceLabel: "alta",
    genreSources: [
      source("manual_override", "Correção manual", "used"),
      ...profile.genreSources.filter((item) => item.id !== "manual_override"),
    ],
    genreEvidence: [manualEvidence, ...profile.genreEvidence].slice(0, 20),
    lastEnrichedAt: override.updated_at,
    manualOverride: true,
    manualOverrideEntityType: override.entity_type,
  };
}

async function loadOverrides(
  workspaceId: string | null | undefined,
  profiles: TrackGenreProfile[],
) {
  const admin = createAdminClient();
  if (!admin || !workspaceId || profiles.length === 0) return [];
  const entityIds = unique(
    profiles.flatMap((profile) => [
      profile.spotifyTrackId,
      ...profile.spotifyArtistIds,
    ]),
  );
  const rows: GenreOverrideRow[] = [];
  for (const batch of chunks(entityIds, PROFILE_BATCH_SIZE)) {
    const { data, error } = await admin
      .from("music_genre_overrides")
      .select(OVERRIDE_SELECT)
      .eq("workspace_id", workspaceId)
      .in("entity_id", batch);
    if (error)
      throw new Error(`Genre overrides lookup failed: ${error.message}`);
    rows.push(...((data ?? []) as GenreOverrideRow[]));
  }
  return rows;
}

function overrideForProfile(
  profile: TrackGenreProfile,
  overrides: GenreOverrideRow[],
) {
  return (
    overrides.find(
      (override) =>
        override.entity_type === "track" &&
        override.entity_id === profile.spotifyTrackId,
    ) ??
    overrides.find(
      (override) =>
        override.entity_type === "artist" &&
        profile.spotifyArtistIds.includes(override.entity_id),
    )
  );
}

async function persistProfiles(profiles: TrackGenreProfile[]) {
  const admin = createAdminClient();
  if (!admin || profiles.length === 0) return;
  for (const batch of chunks(profiles, PROFILE_BATCH_SIZE)) {
    const { error } = await admin
      .from("track_genre_profiles")
      .upsert(batch.map(profileToRow), { onConflict: "spotify_track_id" });
    if (error) {
      throw new Error(
        `Track genre profile persistence failed: ${error.message}`,
      );
    }
  }
}

async function loadSpotifyProfile(input: TrackProfileInput) {
  try {
    const { data } = await withSpotifyToken(async (token) => {
      const track = await fetchJson<SpotifyTrackPayload>(
        `https://api.spotify.com/v1/tracks/${encodeURIComponent(input.spotifyTrackId)}?market=BR`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const artistIds = unique(
        (track.artists ?? []).map((artist) => artist.id ?? "").filter(Boolean),
      );
      let artists: SpotifyArtistPayload[] = [];
      if (artistIds.length > 0) {
        const artistResults = await Promise.allSettled(
          artistIds
            .slice(0, 10)
            .map((artistId) =>
              fetchJson<SpotifyArtistPayload>(
                `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}`,
                { headers: { Authorization: `Bearer ${token}` } },
              ),
            ),
        );
        artists = artistResults.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
      }
      return { track, artists };
    });
    const artistGenres = unique(
      (data.artists ?? []).flatMap((artist) => artist.genres ?? []),
    );
    return {
      input: {
        ...input,
        name: data.track.name ?? input.name,
        artists:
          (data.track.artists ?? [])
            .map((artist) => artist.name)
            .filter(Boolean)
            .join(", ") || input.artists,
        albumName: data.track.album?.name ?? input.albumName,
        isrc: data.track.external_ids?.isrc ?? input.isrc,
        artistIds: (data.track.artists ?? [])
          .map((artist) => artist.id ?? "")
          .filter(Boolean),
        artistGenres,
      } satisfies TrackProfileInput,
      sources: [
        source("spotify_metadata", "Spotify metadata", "used"),
        source(
          "spotify_artist_genres",
          "Spotify artist genres",
          artistGenres.length > 0 ? "used" : "empty",
        ),
      ],
    };
  } catch {
    return {
      input,
      sources: [
        source("spotify_metadata", "Spotify metadata", "unavailable"),
        source("spotify_artist_genres", "Spotify artist genres", "unavailable"),
      ],
    };
  }
}

function musicBrainzTags(recording: MusicBrainzRecording | undefined) {
  if (!recording) return [];
  return unique([
    ...(recording.genres ?? []).map((genre) => genre.name ?? ""),
    ...(recording.tags ?? []).map((tag) => tag.name ?? ""),
  ]).filter(Boolean);
}

async function loadMusicBrainzEvidence(input: TrackProfileInput) {
  try {
    let payload: MusicBrainzPayload;
    if (input.isrc) {
      payload = await fetchMusicBrainzJson<MusicBrainzPayload>(
        `${MUSICBRAINZ_BASE_URL}/isrc/${encodeURIComponent(input.isrc)}?inc=genres+tags+artist-credits&fmt=json`,
      );
    } else {
      const query = `recording:${JSON.stringify(input.name ?? "")} AND artist:${JSON.stringify(input.artists ?? "")}`;
      payload = await fetchMusicBrainzJson<MusicBrainzPayload>(
        `${MUSICBRAINZ_BASE_URL}/recording?query=${encodeURIComponent(query)}&limit=3&fmt=json`,
      );
      const matchId = payload.recordings?.[0]?.id;
      if (matchId) {
        const recording = await fetchMusicBrainzJson<MusicBrainzRecording>(
          `${MUSICBRAINZ_BASE_URL}/recording/${encodeURIComponent(matchId)}?inc=genres+tags+artist-credits&fmt=json`,
        );
        payload = { recordings: [recording] };
      }
    }
    const tags = musicBrainzTags(payload.recordings?.[0]);
    return {
      evidence: createGenreEvidence({
        source: "musicbrainz",
        tags,
        detail: input.isrc
          ? `MusicBrainz consultado pelo ISRC ${input.isrc}.`
          : "MusicBrainz consultado por título e artista.",
        external: true,
      }),
      source: source(
        "musicbrainz",
        "MusicBrainz",
        tags.length > 0 ? "used" : "empty",
      ),
    };
  } catch {
    return {
      evidence: null,
      source: source("musicbrainz", "MusicBrainz", "unavailable"),
    };
  }
}

async function loadLastFmEvidence(input: TrackProfileInput) {
  const apiKey = process.env.LASTFM_API_KEY?.trim();
  if (!apiKey || !input.name || !input.artists) {
    return {
      evidence: [] as TrackGenreEvidence[],
      sources: [
        source("lastfm_track", "Last.fm track tags", "unavailable"),
        source("lastfm_artist", "Last.fm artist tags", "unavailable"),
      ],
    };
  }
  const firstArtist = input.artists.split(",")[0]?.trim() || input.artists;
  const request = async (method: "track.getTopTags" | "artist.getTopTags") => {
    const params = new URLSearchParams({
      method,
      api_key: apiKey,
      artist: firstArtist,
      format: "json",
      autocorrect: "1",
    });
    if (method === "track.getTopTags") params.set("track", input.name ?? "");
    return fetchJson<LastFmPayload>(`${LASTFM_BASE_URL}?${params.toString()}`);
  };
  const results = await Promise.allSettled([
    request("track.getTopTags"),
    request("artist.getTopTags"),
  ]);
  const ids = ["lastfm_track", "lastfm_artist"] as const;
  const labels = ["Last.fm track tags", "Last.fm artist tags"] as const;
  const evidence: TrackGenreEvidence[] = [];
  const sources = results.map((result, index) => {
    if (result.status === "rejected" || result.value.error) {
      return source(ids[index], labels[index], "unavailable");
    }
    const tags = (result.value.toptags?.tag ?? [])
      .slice(0, 20)
      .map((tag) => tag.name ?? "")
      .filter(Boolean);
    const item = createGenreEvidence({
      source: ids[index],
      tags,
      detail: `${labels[index]} consultadas para ${input.name} — ${firstArtist}.`,
      external: true,
    });
    if (item) evidence.push(item);
    return source(
      ids[index],
      labels[index],
      tags.length > 0 ? "used" : "empty",
    );
  });
  return { evidence, sources };
}

export { classifyTrackGenre } from "@/lib/track-genre-taxonomy";

export async function enrichTrackProfile(
  track: TrackProfileInput,
  options: { workspaceId?: string | null } = {},
): Promise<TrackGenreProfile> {
  const spotify = await loadSpotifyProfile(track);
  const [musicBrainz, lastFm] = await Promise.all([
    loadMusicBrainzEvidence(spotify.input),
    loadLastFmEvidence(spotify.input),
  ]);
  const profile = classifyTrackGenre({
    ...spotify.input,
    evidence: [
      ...(musicBrainz.evidence ? [musicBrainz.evidence] : []),
      ...lastFm.evidence,
    ],
    sources: [...spotify.sources, musicBrainz.source, ...lastFm.sources],
  });
  await persistProfiles([profile]);
  const overrides = await loadOverrides(options.workspaceId, [profile]);
  return applyOverride(profile, overrideForProfile(profile, overrides));
}

export async function getTrackGenreProfiles(
  tracks: TrackProfileInput[],
  options: {
    workspaceId?: string | null;
    persistFallbacks?: boolean;
  } = {},
): Promise<Map<string, TrackGenreProfile>> {
  const validTracks = tracks.filter((track) => track.spotifyTrackId);
  const uniqueTracks = [
    ...new Map(
      validTracks.map((track) => [track.spotifyTrackId, track]),
    ).values(),
  ];
  if (uniqueTracks.length === 0) return new Map();

  const admin = createAdminClient();
  const rows: TrackProfileRow[] = [];
  if (admin) {
    for (const batch of chunks(
      uniqueTracks.map((track) => track.spotifyTrackId),
      PROFILE_BATCH_SIZE,
    )) {
      const { data, error } = await admin
        .from("track_genre_profiles")
        .select(PROFILE_SELECT)
        .in("spotify_track_id", batch);
      if (error) {
        // The migration can be deployed independently; classification still works.
        break;
      }
      rows.push(...((data ?? []) as TrackProfileRow[]));
    }
  }

  const storedProfiles = new Map(
    rows.map((row) => [row.spotify_track_id, profileFromRow(row)]),
  );
  const fallbacks = uniqueTracks.flatMap((track) =>
    storedProfiles.has(track.spotifyTrackId)
      ? []
      : [
          classifyTrackGenre({
            ...track,
            // Workspace playlist context is tenant-specific and must never be
            // written into the reusable global automatic profile.
            playlistContext: undefined,
          }),
        ],
  );
  for (const profile of fallbacks) {
    storedProfiles.set(profile.spotifyTrackId, profile);
  }
  if (options.persistFallbacks && admin && fallbacks.length > 0) {
    await persistProfiles(fallbacks).catch(() => undefined);
  }

  const profileList = uniqueTracks.flatMap((track) => {
    const base = storedProfiles.get(track.spotifyTrackId);
    if (!base) return [];
    if (!track.playlistContext?.length) return [base];
    const contextual = classifyTrackGenre({
      ...track,
      name: track.name || base.trackName,
      artists: track.artists || base.artistName,
      albumName: track.albumName || base.albumName,
      isrc: track.isrc || base.isrc,
      artistIds: track.artistIds?.length
        ? track.artistIds
        : base.spotifyArtistIds,
      evidence: base.genreEvidence.filter(
        (item) =>
          item.source !== "manual_override" &&
          item.source !== "spotify_metadata" &&
          item.source !== "workspace_context" &&
          item.source !== "internal_taxonomy",
      ),
      sources: base.genreSources,
    });
    return [{ ...contextual, lastEnrichedAt: base.lastEnrichedAt }];
  });
  const overrides = await loadOverrides(options.workspaceId, profileList).catch(
    () => [],
  );
  return new Map(
    profileList.map((profile) => [
      profile.spotifyTrackId,
      applyOverride(profile, overrideForProfile(profile, overrides)),
    ]),
  );
}

export async function getTrackGenreProfile(
  trackId: string,
  options: {
    workspaceId?: string | null;
    fallback?: Omit<TrackProfileInput, "spotifyTrackId">;
  } = {},
) {
  const profiles = await getTrackGenreProfiles(
    [{ spotifyTrackId: trackId, ...options.fallback }],
    { workspaceId: options.workspaceId },
  );
  return profiles.get(trackId) ?? null;
}

export async function getPlaylistGenreProfile(
  playlistId: string,
  options: { workspaceId?: string | null } = {},
): Promise<PlaylistGenreProfile | null> {
  const { result } = await fetchSpotifyEditablePlaylist(playlistId);
  if (!result.connected || !result.playlist) return null;
  const playlist = result.playlist;
  const profiles = await getTrackGenreProfiles(
    playlist.tracks.map((track) => ({
      spotifyTrackId: track.id,
      name: track.name,
      artists: track.artists,
      albumName: track.albumName,
      playlistContext: [
        { name: playlist.name, description: playlist.description },
      ],
    })),
    { workspaceId: options.workspaceId, persistFallbacks: true },
  );
  const counts = new Map<TrackProfileGenre, number>();
  for (const profile of profiles.values()) {
    if (profile.primaryGenre === "desconhecido") continue;
    counts.set(
      profile.primaryGenre,
      (counts.get(profile.primaryGenre) ?? 0) + 1,
    );
  }
  const ranked = [...counts.entries()].sort(
    (left, right) => right[1] - left[1],
  );
  const classifiedTracks = ranked.reduce(
    (total, [, count]) => total + count,
    0,
  );
  const primaryCount = ranked[0]?.[1] ?? 0;
  return {
    playlistId: playlist.id,
    playlistName: playlist.name,
    primaryGenre: ranked[0]?.[0] ?? "desconhecido",
    secondaryGenres: ranked.slice(1, 4).map(([genre]) => genre),
    genreConfidence:
      classifiedTracks > 0
        ? Math.round((primaryCount / classifiedTracks) * 100)
        : 0,
    totalTracks: playlist.tracks.length,
    classifiedTracks,
    distribution: ranked.map(([genre, tracks]) => ({
      genre,
      tracks,
      share:
        classifiedTracks > 0
          ? Math.round((tracks / classifiedTracks) * 100)
          : 0,
    })),
    lastCalculatedAt: new Date().toISOString(),
  };
}

export function toTrackGenreCardProfile(
  profile: TrackGenreProfile | undefined,
) {
  if (!profile) return null;
  return {
    primaryGenre: profile.primaryGenre,
    label:
      profile.primaryGenre === "piseiro_forro"
        ? "Piseiro / Forró"
        : profile.primaryGenre === "dance_eletronico"
          ? "Dance / Eletrônico"
          : profile.primaryGenre === "afro_latin"
            ? "Afro / Latin"
            : profile.primaryGenre === "pop_global"
              ? "Pop Global"
              : profile.primaryGenre === "desconhecido"
                ? "Gênero em análise"
                : `${profile.primaryGenre.charAt(0).toUpperCase()}${profile.primaryGenre.slice(1)}`,
    genreConfidence: profile.genreConfidence,
    confidenceLabel: profile.confidenceLabel,
    manualOverride: profile.manualOverride,
    moodTags: profile.moodTags,
    energyTags: profile.energyTags,
  };
}

export async function attachTrackProfilesToMusicIntelligence(
  data: MusicIntelligenceResponse,
  workspaceId: string | null | undefined,
): Promise<MusicIntelligenceResponse> {
  // Keep the dashboard contract resilient if an older/partial payload is
  // returned while a deployment is rolling between versions.
  if (!data.markets?.BR || !data.markets?.GLOBAL) return data;
  const allTracks = [
    ...data.markets.BR.addNow,
    ...data.markets.BR.watch,
    ...data.markets.BR.review,
    ...data.markets.GLOBAL.addNow,
    ...data.markets.GLOBAL.watch,
    ...data.markets.GLOBAL.review,
    ...data.crossover,
  ];
  const profiles = await getTrackGenreProfiles(
    allTracks.flatMap((track) =>
      track.spotifyTrackId
        ? [
            {
              spotifyTrackId: track.spotifyTrackId,
              name: track.name,
              artists: track.artists,
              chartCountry: track.primaryCountry,
            },
          ]
        : [],
    ),
    { workspaceId, persistFallbacks: true },
  );
  const withProfile = (
    track: MusicIntelligenceTrack,
  ): MusicIntelligenceTrack => ({
    ...track,
    genreProfile: track.spotifyTrackId
      ? toTrackGenreCardProfile(profiles.get(track.spotifyTrackId))
      : null,
  });
  const optional = (track: MusicIntelligenceTrack | null) =>
    track ? withProfile(track) : null;
  const queue = (
    value: MusicIntelligenceMarketQueue,
  ): MusicIntelligenceMarketQueue => ({
    nextBestOpportunity: optional(value.nextBestOpportunity),
    addNow: value.addNow.map(withProfile),
    watch: value.watch.map(withProfile),
    review: value.review.map(withProfile),
  });

  return {
    ...data,
    markets: {
      BR: queue(data.markets.BR),
      GLOBAL: queue(data.markets.GLOBAL),
    },
    nextBestOpportunity: optional(data.nextBestOpportunity),
    addNow: data.addNow.map(withProfile),
    watch: data.watch.map(withProfile),
    review: data.review.map(withProfile),
    crossover: data.crossover.map(withProfile),
    signals: {
      ...data.signals,
      topRisers: data.signals.topRisers.map(withProfile),
      newEntries: data.signals.newEntries.map(withProfile),
      biggestDrops: data.signals.biggestDrops.map(withProfile),
    },
    candidatePool: {
      // The full pool is server-only decision context. Profiling it on every
      // dashboard request would create unnecessary DB work and payload growth.
      BR: data.candidatePool.BR,
      GLOBAL: data.candidatePool.GLOBAL,
    },
  };
}

export async function saveTrackGenreOverride(input: SaveGenreOverrideInput) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin client unavailable.");
  const timestamp = new Date().toISOString();
  const { error } = await admin.from("music_genre_overrides").upsert(
    {
      workspace_id: input.workspaceId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      primary_genre: input.primaryGenre,
      secondary_genres: input.secondaryGenres ?? [],
      subgenres: cleanList(input.subgenres),
      mood_tags: cleanList(input.moodTags),
      energy_tags: cleanList(input.energyTags),
      language_signal: cleanText(input.languageSignal) || null,
      country_signal: cleanText(input.countrySignal) || null,
      note: cleanText(input.note, 500) || null,
      updated_by: input.userId,
      updated_at: timestamp,
    },
    { onConflict: "workspace_id,entity_type,entity_id" },
  );
  if (error) throw new Error(`Genre override save failed: ${error.message}`);
}

export async function deleteTrackGenreOverride({
  workspaceId,
  entityType,
  entityId,
}: {
  workspaceId: string;
  entityType: "track" | "artist";
  entityId: string;
}) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase admin client unavailable.");
  const { error } = await admin
    .from("music_genre_overrides")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (error) throw new Error(`Genre override delete failed: ${error.message}`);
}
