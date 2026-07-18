export const TRACK_PROFILE_GENRES = [
  "funk",
  "trap",
  "rap",
  "sertanejo",
  "piseiro_forro",
  "pop",
  "pop_global",
  "rock",
  "dance_eletronico",
  "afro_latin",
  "desconhecido",
] as const;

export type TrackProfileGenre = (typeof TRACK_PROFILE_GENRES)[number];

export type TrackGenreConfidenceLabel = "alta" | "media" | "baixa";

export type TrackGenreSourceId =
  | "manual_override"
  | "spotify_metadata"
  | "spotify_artist_genres"
  | "musicbrainz"
  | "lastfm_track"
  | "lastfm_artist"
  | "deezer_catalog"
  | "apple_catalog"
  | "workspace_context"
  | "internal_taxonomy";

export type TrackGenreSource = {
  id: TrackGenreSourceId;
  label: string;
  status: "used" | "empty" | "unavailable";
};

export type TrackGenreEvidence = {
  source: TrackGenreSourceId;
  genres: TrackProfileGenre[];
  tags: string[];
  detail: string;
  weight: number;
  external: boolean;
};

export type TrackProfileInput = {
  spotifyTrackId: string;
  name?: string | null;
  artists?: string | null;
  albumName?: string | null;
  isrc?: string | null;
  artistIds?: string[];
  artistGenres?: string[];
  chartCountry?: "BR" | "GLOBAL" | null;
  playlistContext?: Array<{
    name: string;
    description?: string | null;
  }>;
};

export type TrackGenreProfile = {
  spotifyTrackId: string;
  spotifyArtistIds: string[];
  trackName: string;
  artistName: string;
  albumName: string | null;
  isrc: string | null;
  primaryGenre: TrackProfileGenre;
  secondaryGenres: TrackProfileGenre[];
  subgenres: string[];
  moodTags: string[];
  energyTags: string[];
  languageSignal: string;
  countrySignal: string;
  genreConfidence: number;
  confidenceLabel: TrackGenreConfidenceLabel;
  genreSources: TrackGenreSource[];
  genreEvidence: TrackGenreEvidence[];
  lastEnrichedAt: string;
  manualOverride: boolean;
  manualOverrideEntityType: "track" | "artist" | null;
};

export type TrackGenreCardProfile = Pick<
  TrackGenreProfile,
  "primaryGenre" | "genreConfidence" | "confidenceLabel" | "manualOverride"
> & {
  label: string;
  moodTags?: string[];
  energyTags?: string[];
};

export type PlaylistGenreProfile = {
  playlistId: string;
  playlistName: string;
  primaryGenre: TrackProfileGenre;
  secondaryGenres: TrackProfileGenre[];
  genreConfidence: number;
  totalTracks: number;
  classifiedTracks: number;
  distribution: Array<{
    genre: TrackProfileGenre;
    tracks: number;
    share: number;
  }>;
  lastCalculatedAt: string;
};

export const TRACK_PROFILE_GENRE_LABELS: Record<TrackProfileGenre, string> = {
  funk: "Funk",
  trap: "Trap",
  rap: "Rap",
  sertanejo: "Sertanejo",
  piseiro_forro: "Piseiro / Forró",
  pop: "Pop",
  pop_global: "Pop Global",
  rock: "Rock",
  dance_eletronico: "Dance / Eletrônico",
  afro_latin: "Afro / Latin",
  desconhecido: "Gênero em análise",
};

export function isTrackProfileGenre(
  value: unknown,
): value is TrackProfileGenre {
  return (
    typeof value === "string" &&
    (TRACK_PROFILE_GENRES as readonly string[]).includes(value)
  );
}
