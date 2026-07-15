export type MusicIntelligenceCountry = "BR" | "GLOBAL";

export type MusicIntelligenceStatus =
  "ready" | "partial" | "empty" | "unavailable";

export type MusicIntelligenceWindow = 7 | 14 | 30 | 60 | 90 | 180 | 365;

export type MusicIntelligenceAction = "add_now" | "watch" | "review";

export type MusicIntelligenceScores = {
  heatScore: number;
  momentumScore: number;
  freshnessScore: number;
  stabilityScore: number;
  saturationRisk: number;
  crossoverScore: number;
  opportunityScore: number;
};

export type MusicIntelligenceTrack = {
  id: string;
  snapshotTrackId: string | null;
  spotifyTrackId: string | null;
  spotifyUrl: string | null;
  name: string;
  artists: string;
  coverUrl: string | null;
  primaryCountry: MusicIntelligenceCountry;
  countries: MusicIntelligenceCountry[];
  currentPosition: number;
  positions: Partial<Record<MusicIntelligenceCountry, number>>;
  previousPosition: number | null;
  movement24h: number | null;
  movement7d: number | null;
  movement14d: number | null;
  movement30d: number | null;
  peakPosition: number;
  streams: number | null;
  observedDays30: number;
  isNewEntry: boolean;
  action: MusicIntelligenceAction;
  actionLabel: string;
  suggestedPlaylistName: string | null;
  explanation: string;
  scores: MusicIntelligenceScores;
};

export type MusicIntelligenceArtistSignal = {
  artist: string;
  tracks: number;
  averageOpportunityScore: number;
};

export type MusicIntelligenceMarketQueue = {
  nextBestOpportunity: MusicIntelligenceTrack | null;
  addNow: MusicIntelligenceTrack[];
  watch: MusicIntelligenceTrack[];
  review: MusicIntelligenceTrack[];
};

export type MusicIntelligenceSummary = {
  latestChartDate: string | null;
  availableDaysBR: number;
  availableDaysGlobal: number;
  totalTracksAnalyzed: number;
  totalCandidates: number;
  maxWindow: number;
  availableWindows: MusicIntelligenceWindow[];
  windowStart: string | null;
  windowEnd: string | null;
  status: MusicIntelligenceStatus;
  statusLabel: string;
  statusDetail: string;
  newEntries: number;
  topRisers: number;
  biggestDrops: number;
};

export type MusicIntelligenceResponse = {
  summary: MusicIntelligenceSummary;
  markets: Record<MusicIntelligenceCountry, MusicIntelligenceMarketQueue>;
  nextBestOpportunity: MusicIntelligenceTrack | null;
  addNow: MusicIntelligenceTrack[];
  watch: MusicIntelligenceTrack[];
  review: MusicIntelligenceTrack[];
  crossover: MusicIntelligenceTrack[];
  signals: {
    topRisers: MusicIntelligenceTrack[];
    newEntries: MusicIntelligenceTrack[];
    biggestDrops: MusicIntelligenceTrack[];
    risingArtists: MusicIntelligenceArtistSignal[];
  };
  meta: {
    generatedAt: string;
    methodologyVersion: "v1";
    source: "spotify_chart_complete_snapshots";
  };
};
