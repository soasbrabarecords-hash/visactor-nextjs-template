import type {
  ChannelDatum,
  DashboardMetric,
  PlaylistRecord,
  ScoreBreakdown,
} from "@/types/dashboard";
import type { TrackInsight } from "@/types/charts";

export type SuggestedTrackInsight = TrackInsight & {
  reason: string;
};

export type PlaylistAnalysisData = {
  playlist: PlaylistRecord;
  metrics: DashboardMetric[];
  artistDistribution: ChannelDatum[];
  popularityHealth: ScoreBreakdown;
  overlapWithMarket: number;
  currentTracks: TrackInsight[];
  suggestedTracks: SuggestedTrackInsight[];
  curatorNotes: string[];
};
