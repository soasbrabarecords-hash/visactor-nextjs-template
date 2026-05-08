export type PlaylistTimelineMetric = {
  date: string;
  type: "created" | "scored";
  count: number;
};

export type DashboardMetric = {
  title: string;
  value: string;
  change: number;
};

export type PlaylistActivityDatum = {
  date: string;
  created: number;
  scored: number;
};

export type ConversionDatum = {
  name: string;
  value: number;
};

export type ChannelDatum = {
  type: string;
  value: number;
};

export type ScoreBreakdown = {
  positive: number;
  neutral: number;
  negative: number;
};

export type PlaylistRecord = {
  id: string;
  createdAt: string | null;
  url: string;
  name: string;
  coverUrl: string | null;
  followers: number;
  tracks: number;
  score: number;
};

export type DashboardData = {
  metrics: DashboardMetric[];
  playlistActivity: PlaylistActivityDatum[];
  topFollowers: ConversionDatum[];
  scoreDistribution: ChannelDatum[];
  scoreHealth: ScoreBreakdown;
  playlistCount: number;
  playlists: PlaylistRecord[];
};
