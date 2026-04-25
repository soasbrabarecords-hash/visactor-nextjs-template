import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  CustomerSatisfication,
  Metrics,
  TicketByChannels,
} from "@/components/chart-blocks";
import Container from "@/components/container";
import TracksTable from "@/components/charts/tracks-table";
import CuratorNotesPanel from "@/components/playlists/curator-notes-panel";
import SuggestedTracksTable from "@/components/playlists/suggested-tracks-table";
import { Button } from "@/components/ui/button";
import { getPlaylistAnalysisData } from "@/lib/playlist-analysis-data";

export const dynamic = "force-dynamic";

export default async function PlaylistAnalysisPage({
  params,
}: {
  params: Promise<{ playlistId: string }>;
}) {
  const { playlistId } = await params;
  const analysis = await getPlaylistAnalysisData(playlistId);

  if (!analysis) {
    notFound();
  }

  return (
    <div>
      <Container className="border-b border-border py-6">
        <div className="grid gap-5 laptop:grid-cols-[140px_1fr_auto] laptop:items-center">
          {analysis.playlist.coverUrl ? (
            <div
              className="h-32 w-32 rounded-3xl"
              style={{
                backgroundImage: `url(${analysis.playlist.coverUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
            />
          ) : (
            <div className="h-32 w-32 rounded-3xl bg-muted" />
          )}

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Janela de Analise
            </div>
            <h1 className="text-3xl font-semibold">{analysis.playlist.name}</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Painel de leitura editorial para entender se a playlist esta
              conectada com o mercado e quais faixas relacionadas podem elevar a
              curadoria.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/">Voltar</Link>
            </Button>
            <Button asChild>
              <a
                href={analysis.playlist.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2"
              >
                Abrir playlist
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </Container>

      <Metrics metrics={analysis.metrics} />

      <div className="grid grid-cols-1 divide-y border-b border-border laptop:grid-cols-3 laptop:divide-x laptop:divide-y-0 laptop:divide-border">
        <Container className="py-4 laptop:col-span-1">
          <CuratorNotesPanel
            notes={analysis.curatorNotes}
            overlapWithMarket={analysis.overlapWithMarket}
          />
        </Container>

        <Container className="py-4 laptop:col-span-1">
          <TicketByChannels
            data={analysis.artistDistribution}
            title="Artist DNA"
            centerLabel="Artistas dominantes"
          />
        </Container>

        <Container className="py-4 laptop:col-span-1">
          <CustomerSatisfication
            customerSatisfication={analysis.popularityHealth}
            totalCustomers={analysis.currentTracks.length}
            title="Faixa Health"
            totalLabel="Faixas atuais"
            totalSuffix="tracks"
            labels={{
              positive: "Alta tracao",
              neutral: "Media tracao",
              negative: "Baixa tracao",
            }}
          />
        </Container>
      </div>

      <div className="border-b border-border">
        <SuggestedTracksTable tracks={analysis.suggestedTracks} />
      </div>

      <div className="border-b border-border">
        <TracksTable
          tracks={analysis.currentTracks}
          title="Faixas Atuais da Playlist"
          description="Leitura completa do repertorio atual para apoiar a decisao editorial."
          emptyMessage="Nao encontramos as faixas desta playlist para analise."
        />
      </div>
    </div>
  );
}
