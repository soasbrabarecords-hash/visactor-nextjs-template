import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import PageIntro from "@/components/page-intro";
import StatusBadge from "@/components/workspace/status-badge";
import PlaylistEditor from "@/components/workspace/playlist-editor";
import PlaylistKworbSuggestions from "@/components/workspace/playlist-kworb-suggestions";
import {
  fetchSpotifyEditablePlaylist,
  fetchPlaylistSnapshotId,
} from "@/lib/spotify-user";

export const dynamic = "force-dynamic";

function coverStyle(coverUrl: string | null) {
  if (!coverUrl) return undefined;
  return {
    backgroundImage: `url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

export default async function SpotifyPlaylistEditorPage({
  params,
}: {
  params: Promise<{ playlistId: string }>;
}) {
  const { playlistId } = await params;
  const { result } = await fetchSpotifyEditablePlaylist(playlistId);

  if (!result.connected) {
    return (
      <div>
        <TopNav title="Editar playlist" />
        <PageIntro
          eyebrow="Spotify"
          title="Playlist indisponivel"
          description={result.message}
        />
        <Container className="border-b border-border py-6">
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href="/api/spotify/auth/login">Conectar Spotify</a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/curadoria">Voltar para Curadoria</Link>
            </Button>
          </div>
        </Container>
      </div>
    );
  }

  const { playlist } = result;

  // Busca snapshot_id atual para operações de edição
  const { snapshotId } = await fetchPlaylistSnapshotId(playlistId).catch(() => ({
    snapshotId: "",
    refreshedToken: null,
  }));

  return (
    <div>
      <TopNav title="Editar playlist" />
      <PageIntro
        eyebrow="Curadoria Spotify"
        title={playlist.name}
        description="Selecione uma faixa com o mouse ou teclado. Pressione Delete para remover. Arraste pelo grip para reordenar. Clique no nome ou descrição para editar."
      />

      <Container className="border-b border-border py-6">
        <div className="grid gap-5 laptop:grid-cols-[148px_1fr_auto] laptop:items-start">
          <div
            className="h-36 w-36 rounded-3xl border border-border bg-muted shadow-2xl"
            style={coverStyle(playlist.imageUrl)}
          />

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={playlist.isPublic ? "green" : "slate"}>
                {playlist.isPublic ? "Publica" : "Privada"}
              </StatusBadge>
              {playlist.isCollaborative ? (
                <StatusBadge tone="purple">Colaborativa</StatusBadge>
              ) : null}
              <StatusBadge tone="blue">Criada pela conta</StatusBadge>
              <StatusBadge tone="green">Fase 2 ativa</StatusBadge>
            </div>

            <div className="grid gap-3 laptop:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Faixas
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {formatCount(playlist.tracksTotal)}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Dono
                </div>
                <div className="mt-2 truncate text-lg font-semibold">
                  {playlist.ownerName}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Edicao
                </div>
                <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-green-500">
                  Ativa
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 laptop:justify-end">
            <Button asChild variant="outline">
              <Link href="/curadoria">Voltar</Link>
            </Button>
            <Button asChild>
              <a
                href={playlist.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2"
              >
                Abrir Spotify
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </Container>

      <Container className="border-b border-border py-6">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Editor de playlist
          </div>
          <h2 className="mt-2 text-2xl font-semibold">Faixas e edição</h2>
        </div>

        <PlaylistEditor
          playlistId={playlistId}
          initialTracks={playlist.tracks}
          initialSnapshotId={snapshotId}
          initialName={playlist.name}
          initialDescription={playlist.description}
        />
      </Container>

      <PlaylistKworbSuggestions
        playlistId={playlistId}
        playlistName={playlist.name}
        playlistDescription={playlist.description}
        currentTrackIds={playlist.tracks.map((t) => t.id)}
      />
    </div>
  );
}
