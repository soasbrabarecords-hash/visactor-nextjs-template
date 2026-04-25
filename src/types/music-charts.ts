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

export type MusicTrackHighlight = {
  id: string;
  name: string;
  artists: string;
  coverUrl: string | null;
  spotifyUrl: string;
  primaryMetric: string;
  secondaryMetric: string;
  summary: string;
};

export type MusicOpportunity = {
  title: string;
  description: string;
  rationale: string;
  badge: string;
  seeds: Array<{
    id: string;
    name: string;
    artists: string;
    coverUrl: string | null;
    spotifyUrl: string;
  }>;
};

export type MusicChartsData = {
  metrics: DashboardMetric[];
  topTracks: ConversionDatum[];
  artistDistribution: ChannelDatum[];
  popularityHealth: ScoreBreakdown;
  tracks: TrackInsight[];
  topMovers: MusicTrackHighlight[];
  newEntries: MusicTrackHighlight[];
  recurringTracks: TrackInsight[];
  opportunities: MusicOpportunity[];
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
