import type { ArtistRole } from "@/lib/label-os-taxonomy";

export type LabelArtist = {
  id: string;
  name: string;
  artist_name: string | null;
  roles: ArtistRole[];
  email: string | null;
  phone: string | null;
  instagram: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
  document: string | null;
  birth_date: string | null;
  notes: string | null;
  created_at: string;
};

export type LabelArtistInput = Omit<LabelArtist, "id" | "created_at">;

export type LabelTrack = {
  id: string;
  title: string;
  version: string | null;
  isrc: string | null;
  upc: string | null;
  release_date: string | null;
  status: string;
  genre: string | null;
  subgenre: string | null;
  bpm: number | null;
  key: string | null;
  explicit: boolean;
  cover_url: string | null;
  audio_url: string | null;
  contract_url: string | null;
  notes: string | null;
  lyrics: string | null;
  created_at: string;
};

export type LabelTrackInput = Omit<LabelTrack, "id" | "created_at">;

export type TrackParticipant = {
  id: string;
  track_id: string;
  artist_id: string | null;
  entity_id: string | null;
  role: string;
  royalty_percentage: number;
  publishing_percentage: number;
  master_percentage: number;
  created_at: string;
  label_artists?: Pick<LabelArtist, "id" | "name" | "artist_name">;
  label_entities?: {
    id: string;
    name: string;
    display_name: string | null;
    type: string;
  };
};

export type TrackParticipantInput = Omit<
  TrackParticipant,
  "id" | "created_at" | "label_artists" | "label_entities"
>;

export type LabelOsStats = {
  totalTracks: number;
  totalArtists: number;
  draftTracks: number;
  releasedTracks: number;
};
