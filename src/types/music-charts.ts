import type {
  ChannelDatum,
  ConversionDatum,
  DashboardMetric,
  ScoreBreakdown,
} from "@/types/dashboard";
import type { FeaturedPlaylistInsight, TrackInsight } from "@/types/charts";

export type MusicFilterOption = {
  value: string;
  label: string;
};

export type MusicChartsData = {
  metrics: DashboardMetric[];
  topTracks: ConversionDatum[];
  artistDistribution: ChannelDatum[];
  popularityHealth: ScoreBreakdown;
  tracks: TrackInsight[];
  featuredPlaylists: FeaturedPlaylistInsight[];
  countryValue: string;
  countryLabel: string;
  genreValue: string;
  genreLabel: string;
  topTrackName: string;
  explicitShare: string;
  marketHighlight: string;
  sourcePlaylistsCount: number;
};
