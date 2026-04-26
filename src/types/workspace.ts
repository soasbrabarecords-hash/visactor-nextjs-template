import type { PlaylistRecord } from "@/types/dashboard";
import type { MusicFilterOption } from "@/types/music-charts";

export type StatusTone =
  | "green"
  | "red"
  | "blue"
  | "purple"
  | "yellow"
  | "slate";

export type WorkspaceMetric = {
  title: string;
  value: string;
  helper: string;
  tone: StatusTone;
};

export type WorkspaceInsight = {
  eyebrow: string;
  title: string;
  description: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};

export type HeroInsight = {
  headline: string;
  summary: string;
  tone: StatusTone;
  supportingPoints: string[];
};

export type RecommendedAction = {
  title: string;
  summary: string;
  tone: StatusTone;
  items: string[];
};

export type PrimaryAction = {
  track: DecisionTrack | null;
  reason: string;
};

export type DashboardWorkspaceData = {
  hero: WorkspaceInsight;
  heroInsight: HeroInsight;
  metrics: WorkspaceMetric[];
  primaryAction: PrimaryAction;
  recommendedActions: RecommendedAction[];
  addNow: DecisionTrack[];
  observe: DecisionTrack[];
  removeOrTest: DecisionTrack[];
};

export type MovementType = "up" | "down" | "same" | "new" | "reentry";

export type PeriodFilter = "today" | "7d" | "30d";

export type RadarStatusFilter =
  | "all"
  | "new"
  | "up"
  | "down"
  | "recurring"
  | "low-saturation";

export type MovementDescriptor = {
  type: MovementType;
  label: string;
  icon: string;
  tone: StatusTone;
  valueLabel: string;
};

export type ScoreBreakdownItem = {
  label: string;
  value: string;
  tone: StatusTone;
};

export type RadarMusicSummaryCard = {
  title: string;
  value: string;
  helper: string;
  tone: StatusTone;
  coverUrl: string | null;
  accentLabel: string;
  detail: string;
};

export type RadarMusicEditorialHero = {
  badge: string;
  headline: string;
  summary: string;
  coverUrl: string | null;
  trackName: string;
  artists: string;
  rankLabel: string;
  movementLabel: string;
  genreLabel: string;
  countryLabel: string;
  periodLabel: string;
  spotifyUrl: string;
  stats: Array<{
    label: string;
    value: string;
    tone: StatusTone;
  }>;
};

export type RadarMusicGenreSpotlight = {
  value: string;
  label: string;
  description: string;
  href: string;
  coverUrl: string | null;
  chipLabel: string;
  tone: StatusTone;
  isActive: boolean;
};

export type RadarMusicRow = {
  rank: number;
  movement: MovementDescriptor;
  trackId: string;
  name: string;
  artists: string;
  albumName: string;
  popularity: number;
  previousRank: number | null;
  rankChange: number | null;
  daysOnRadar: number;
  opportunityScore: number;
  spotifyUrl: string;
  coverUrl: string | null;
  statusTags: string[];
  lowSaturation: boolean;
  recurring: boolean;
  alreadyInPlaylists: boolean;
  fitLabel: string;
  scoreBreakdown: ScoreBreakdownItem[];
};

export type RadarMusicSupport = {
  sourceModeLabel: string;
  sourceModeDescription: string;
  updatedAtLabel: string;
  sampleSize: number;
  historyDaysTracked: number;
  marketHighlight: string;
};

export type RadarMusicPageData = {
  hero: WorkspaceInsight;
  heroInsight: HeroInsight;
  editorialHero: RadarMusicEditorialHero;
  genreSpotlights: RadarMusicGenreSpotlight[];
  filters: {
    countryOptions: MusicFilterOption[];
    genreOptions: MusicFilterOption[];
    periodOptions: MusicFilterOption[];
    statusOptions: MusicFilterOption[];
    selectedCountry: string;
    selectedCountryLabel: string;
    selectedGenre: string;
    selectedGenreLabel: string;
    selectedPeriod: PeriodFilter;
    selectedStatus: RadarStatusFilter;
  };
  summaryCards: RadarMusicSummaryCard[];
  rows: RadarMusicRow[];
  support: RadarMusicSupport;
};

export type RadarPlaylistRow = {
  trackId: string;
  name: string;
  artists: string;
  playlistsLabel: string;
  playlistsCount: number;
  popularity: number;
  repetitionLabel: string;
  status: {
    label: string;
    tone: StatusTone;
  };
  actionHref: string;
  coverUrl: string | null;
};

export type RadarPlaylistsData = {
  hero: WorkspaceInsight;
  heroInsight: HeroInsight;
  metrics: WorkspaceMetric[];
  rows: RadarPlaylistRow[];
  sharedMomentum: RadarPlaylistRow[];
};

export type PlaylistBaseRow = {
  playlist: PlaylistRecord;
  followersLabel: string;
  growthLabel: string;
  growthTone: StatusTone;
  tracksLabel: string;
  scoreLabel: string;
  lastUpdatedLabel: string;
};

export type PlaylistBaseData = {
  hero: WorkspaceInsight;
  heroInsight: HeroInsight;
  metrics: WorkspaceMetric[];
  rows: PlaylistBaseRow[];
  healthSummary: Array<{
    label: string;
    value: string;
    tone: StatusTone;
  }>;
  comparisonRows: Array<{
    playlistId: string;
    playlistName: string;
    coverUrl: string | null;
    scoreAverageLabel: string;
    repetitionRateLabel: string;
    averagePopularityLabel: string;
    followerGrowthLabel: string;
    followerGrowthTone: StatusTone;
    performanceLabel: string;
  }>;
};

export type DecisionAction = "add" | "observe" | "ignore" | "remove";

export type DecisionTrack = {
  trackId: string;
  name: string;
  artists: string;
  albumName: string;
  coverUrl: string | null;
  spotifyUrl: string;
  popularity: number;
  movement: MovementDescriptor;
  chartDeltaLabel: string;
  lowSaturation: boolean;
  recurring: boolean;
  alreadyInPlaylists: boolean;
  fitLabel: string;
  decisionScore: number;
  recommendedAction: DecisionAction;
  scoreBreakdown: ScoreBreakdownItem[];
};

export type CurationPageData = {
  hero: WorkspaceInsight;
  heroInsight: HeroInsight;
  metrics: WorkspaceMetric[];
  rows: DecisionTrack[];
};
