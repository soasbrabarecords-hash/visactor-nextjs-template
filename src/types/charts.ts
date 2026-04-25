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
  albumName: string;
  popularity: number;
  playlistsCount: number;
  durationLabel: string;
  explicit: boolean;
  spotifyUrl: string;
};

export type ChartsData = {
  metrics: DashboardMetric[];
  topTracks: ConversionDatum[];
  artistDistribution: ChannelDatum[];
  popularityHealth: ScoreBreakdown;
  analyzedPlaylists: number;
  tracks: TrackInsight[];
  topRepeatedTrack: string;
  explicitShare: string;
};
