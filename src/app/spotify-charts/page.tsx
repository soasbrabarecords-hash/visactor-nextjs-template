import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import ModuleGuard from "@/components/workspace/module-guard";
import {
  getSnapshotDates,
  getSnapshotWithComparison,
} from "@/lib/chart-snapshots";
import { getLatestSpotifyChartRun } from "@/lib/charts/spotify-chart-runs";
import SpotifyChartsClient from "./spotify-charts-client";

export const revalidate = 300;

type Props = {
  searchParams: Promise<{ date?: string; country?: string }>;
};

export default async function SpotifyChartsPage({ searchParams }: Props) {
  const params = await searchParams;
  const country = params.country ?? "BR";

  const [dates, latestAutomaticRun] = await Promise.all([
    getSnapshotDates(country),
    getLatestSpotifyChartRun(country).catch(() => null),
  ]);

  // Usa a data do query param ou a mais recente disponível
  const selectedDate = params.date ?? dates[0] ?? null;

  const snapshotData = selectedDate
    ? await getSnapshotWithComparison(selectedDate, country)
    : null;

  return (
    <ModuleGuard moduleKey="playlist_os">
      <div>
        <PageIntro
          eyebrow="Curadoria / Radar Music"
          title="Spotify Charts — Histórico"
          description="Historico visual do Top 200 Brasil com snapshots diarios para leitura de movimento, comparacao e acao rapida."
        />

        <Container className="py-8">
          <SpotifyChartsClient
            initialDates={dates}
            initialDate={selectedDate}
            initialSnapshot={snapshotData}
            country={country}
            latestAutomaticRun={latestAutomaticRun}
          />
        </Container>
      </div>
    </ModuleGuard>
  );
}
