export type ArtistOsRecord = {
  id: string;
  workspace_id?: string | null;
  artist_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type ArtistOsArtistOption = {
  id: string;
  name: string;
  status?: string | null;
};

