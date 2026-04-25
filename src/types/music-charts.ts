import type {
  ChannelDatum,
  ConversionDatum,
  ScoreBreakdown,
} from "@/types/dashboard";
import type { FeaturedPlaylistInsight, TrackInsight } from "@/types/charts";

export type MusicFilterOption = {
  value: string;
  label: string;
};

export type MusicSignalSource = "featured" | "search" | "hybrid" | "empty";

export type MusicWorkbenchMetric = {
  title: string;
  value: string;
  caption: string;
};

export type MusicDataTrustContext = {
  sourceMode: MusicSignalSource;
  sourceModeLabel: string;
  sourceModeDescription: string;
  fallbackActive: boolean;
  updatedAtLabel: string;
  sampleSize: number;
  activeSourceCount: number;
  featuredPlaylistCount: number;
  queryCount: number;
  featuredOnlyCount: number;
  searchOnlyCount: number;
  hybridCount: number;
  marketHighlight: string;
  topTrackName: string;
  explicitShare: string;
  countryLabel: string;
  genreLabel: string;
};

export type MusicTrackHighlight = {
  id: string;
  name: string;
  artists: string;
  coverUrl: string | null;
  spotifyUrl: string;
  badgeLabel: string;
  primaryMetric: string;
  secondaryMetric: string;
  summary: string;
};

export type MusicOpportunity = {
  title: string;
  description: string;
  rationale: string;
  badge: string;
  playlistAngle: string;
  potential: string;
  risk: string;
  callToAction: string;
  seeds: Array<{
    id: string;
    name: string;
    artists: string;
    coverUrl: string | null;
    spotifyUrl: string;
  }>;
};

export type MusicWorkbenchTrack = {
  rank: number;
  id: string;
  name: string;
  artists: string;
  albumName: string;
  popularity: number;
  signalCount: number;
  durationLabel: string;
  explicit: boolean;
  spotifyUrl: string;
  coverUrl: string | null;
  opportunityScore: number;
  sourceLabel: string;
  signalSource: MusicSignalSource;
  tractionLabel: string;
  saturationLabel: string;
  tags: string[];
  isMover: boolean;
  isNewEntry: boolean;
  isRecurring: boolean;
  lowSaturation: boolean;
  highTraction: boolean;
};

export type MusicChartsData = {
  summaryCards: MusicWorkbenchMetric[];
  topTracks: ConversionDatum[];
  artistDistribution: ChannelDatum[];
  popularityHealth: ScoreBreakdown;
  tracks: TrackInsight[];
  topMovers: MusicTrackHighlight[];
  newEntries: MusicTrackHighlight[];
  recurringTracks: TrackInsight[];
  workbenchTracks: MusicWorkbenchTrack[];
  opportunities: MusicOpportunity[];
  featuredPlaylists: FeaturedPlaylistInsight[];
  dataTrust: MusicDataTrustContext;
  countryValue: string;
  countryLabel: string;
  genreValue: string;
  genreLabel: string;
};
