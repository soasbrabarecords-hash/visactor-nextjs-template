import Container from "@/components/container";
import PageIntro from "@/components/page-intro";
import { getSnapshotDates, getSnapshotWithComparison } from "@/lib/chart-snapshots";
import SpotifyChartsClient from "./spotify-charts-client";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ date?: string; country?: string }>;
};

export default async function SpotifyChartsPage({ searchParams }: Props) {
  const params = await searchParams;
  const country = params.country ?? "BR";

  const dates = await getSnapshotDates(country);

  // Usa a data do query param ou a mais recente disponível
  const selectedDate = params.date ?? dates[0] ?? null;

  const snapshotData = selectedDate
    ? await getSnapshotWithComparison(selectedDate, country)
    : null;

  return (
    <div>
      <PageIntro
        eyebrow="Curadoria / Radar Music"
        title="Spotify Charts — Histórico"
        description="Importe CSVs do Spotify Charts Top 200 Brasil. Cada upload salva um snapshot diário persistido, com rastreamento de movimentação de posições."
      />

      <Container className="py-8">
        <SpotifyChartsClient
          initialDates={dates}
          initialDate={selectedDate}
          initialSnapshot={snapshotData}
          country={country}
        />
      </Container>
    </div>
  );
}
