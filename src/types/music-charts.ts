import type {
  ChannelDatum,
  ConversionDatum,
  ScoreBreakdown,
} from "@/types/dashboard";
import type { FeaturedPlaylistInsight, TrackInsight } from "@/types/charts";
import type { MovementType } from "@/types/workspace";

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
  historyDaysTracked: number;
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
  genre: string;
  albumName: string;
  popularity: number;
  dailyStreams: number | null;
  streamRank: number | null;
  streamGrowth: number | null;
  streamVelocityLabel: string;
  popularityChange: number | null;
  previousRank: number | null;
  rankChange: number | null;
  movementType: MovementType;
  daysOnChart: number;
  saturationCount: number;
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
  historyLabel: string;
  tags: string[];
  intelligenceTags: string[];
  sourceNames: string[];
  isMover: boolean;
  isNewEntry: boolean;
  isRecurring: boolean;
  lowSaturation: boolean;
  highTraction: boolean;
};

export type MusicMovementContext = {
  historyDaysTracked: number;
  previousSnapshotDay: string | null;
  hasSufficientHistory: boolean;
  returningTrackCount: number;
};

export type MusicGenreHeat = {
  genre: string;
  genreLabel: string;
  genreHeatScore: number;
  opportunityCount: number;
  trackCount: number;
  leaderTrackId: string | null;
  leaderTrackName: string | null;
  leaderCoverUrl: string | null;
};

export type MusicArtistDominance = {
  artistName: string;
  top20Count: number;
  top50Count: number;
  averagePopularity: number;
  averageOpportunityScore: number;
  dominanceScore: number;
  tags: string[];
  genres: string[];
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
  movementContext: MusicMovementContext;
  hottestGenres: MusicGenreHeat[];
  dominantArtists: MusicArtistDominance[];
  countryValue: string;
  countryLabel: string;
  genreValue: string;
  genreLabel: string;
};
