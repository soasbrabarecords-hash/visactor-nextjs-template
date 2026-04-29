import type {
  ChannelDatum,
  ConversionDatum,
  DashboardMetric,
  ScoreBreakdown,
} from "@/types/dashboard";

export type TrackInsight = {
  id: string;
  name: string;
  artists: string;
  artistIds: string[];
  albumName: string;
  popularity: number;
  playlistsCount: number;
  durationLabel: string;
  explicit: boolean;
  spotifyUrl: string;
  coverUrl: string | null;
};

export type FeaturedPlaylistInsight = {
  id: string;
  name: string;
  description: string;
  coverUrl: string | null;
  spotifyUrl: string;
  tracksTotal: number;
};

export type ChartsData = {
  metrics: DashboardMetric[];
  topTracks: ConversionDatum[];
  artistDistribution: ChannelDatum[];
  popularityHealth: ScoreBreakdown;
  analyzedPlaylists: number;
  tracks: TrackInsight[];
  marketTracks: TrackInsight[];
  featuredPlaylists: FeaturedPlaylistInsight[];
  topRepeatedTrack: string;
  explicitShare: string;
  marketHighlight: string;
  sharedMomentumCount: number;
};
