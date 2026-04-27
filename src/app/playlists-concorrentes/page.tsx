import AddPlaylistForm from "@/components/dashboard/add-playlist-form";
import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import PageIntro from "@/components/page-intro";
import CompetitorPlaylistsTable from "@/components/workspace/competitor-playlists-table";
import PlaylistComparisonTable from "@/components/workspace/playlist-comparison-table";
import RadarPlaylistsTable from "@/components/workspace/radar-playlists-table";
import StatusBadge from "@/components/workspace/status-badge";
import {
  getBasePlaylistsPageData,
  getRadarPlaylistsPageData,
} from "@/lib/workspace-data";

export const dynamic = "force-dynamic";

export default async function PlaylistsConcorrentesPage() {
  const [baseData, radarData] = await Promise.all([
    getBasePlaylistsPageData(),
    getRadarPlaylistsPageData(),
  ]);
  const strongCompetitors = baseData.rows.filter(
    (row) => row.playlist.score >= 80,
  ).length;
  const updateSignals =
    radarData.sharedMomentum.length > 0
      ? radarData.sharedMomentum
      : radarData.rows.slice(0, 6);

  return (
    <div>
      <TopNav title="Playlists Concorrentes" />
      <PageIntro
        eyebrow="Inteligencia competitiva"
        title="Playlists Concorrentes"
        description="Cole links de playlists concorrentes, acompanhe forca, repertorio e sinais que ajudam a melhorar suas proprias curadorias."
      />

      <AddPlaylistForm
        title="Adicionar playlist concorrente"
        description="Cole a URL de uma playlist concorrente do Spotify para monitorar seguidores, tamanho, score e repertorio."
        buttonLabel="Adicionar Concorrente"
      />

      <Container className="border-b border-border py-6">
        <div className="grid gap-3 laptop:grid-cols-3">
          <article className="rounded-2xl border border-border bg-card/70 p-4">
            <StatusBadge tone="blue">Monitoradas</StatusBadge>
            <div className="mt-3 text-3xl font-semibold">{baseData.rows.length}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Playlists concorrentes em acompanhamento.
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card/70 p-4">
            <StatusBadge tone="green">Ameaca forte</StatusBadge>
            <div className="mt-3 text-3xl font-semibold">{strongCompetitors}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Concorrentes com score alto para estudar.
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card/70 p-4">
            <StatusBadge tone="yellow">Sinais de repertorio</StatusBadge>
            <div className="mt-3 text-3xl font-semibold">{updateSignals.length}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Faixas e padroes que aparecem na leitura competitiva.
            </p>
          </article>
        </div>
      </Container>

      <CompetitorPlaylistsTable rows={baseData.rows} />
      <RadarPlaylistsTable
        rows={updateSignals}
        title="O que os concorrentes estao reforcando"
        description="Faixas que aparecem como padrao de repertorio e ajudam a indicar o que observar, testar ou evitar nas suas playlists."
      />
      <PlaylistComparisonTable rows={baseData.comparisonRows} />
    </div>
  );
}
