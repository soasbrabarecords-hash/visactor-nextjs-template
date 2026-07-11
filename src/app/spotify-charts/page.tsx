import Container from "@/components/container";
import ModuleGuard from "@/components/workspace/module-guard";
import {
  getSnapshotDates,
  getSnapshotWithComparison,
} from "@/lib/chart-snapshots";
import { getLatestSpotifyChartRun } from "@/lib/charts/spotify-chart-runs";
import { canCurrentUserBackfillSpotifyCharts } from "@/lib/charts/spotify-charts-admin";
import SpotifyChartsClient from "./spotify-charts-client";

export const revalidate = 300;

type Props = {
  searchParams: Promise<{ date?: string; country?: string }>;
};

export default async function SpotifyChartsPage({ searchParams }: Props) {
  const params = await searchParams;
  const country = params.country?.toUpperCase() === "GLOBAL" ? "GLOBAL" : "BR";

  const [dates, latestAutomaticRun, canBackfill] = await Promise.all([
    getSnapshotDates(country),
    getLatestSpotifyChartRun(country).catch(() => null),
    canCurrentUserBackfillSpotifyCharts().catch(() => false),
  ]);

  // Usa a data do query param ou a mais recente disponível
  const selectedDate = params.date ?? dates[0] ?? null;

  const snapshotData = selectedDate
    ? await getSnapshotWithComparison(selectedDate, country)
    : null;

  return (
    <ModuleGuard moduleKey="playlist_os">
      <div className="overflow-hidden">
        <Container className="py-3">
          <SpotifyChartsClient
            initialDates={dates}
            initialDate={selectedDate}
            initialSnapshot={snapshotData}
            country={country}
            latestAutomaticRun={latestAutomaticRun}
            canBackfill={canBackfill}
          />
        </Container>
      </div>
    </ModuleGuard>
  );
}
