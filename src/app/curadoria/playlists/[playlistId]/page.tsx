import Link from "next/link";
import { ExternalLink, Lock, Music2 } from "lucide-react";
import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import PageIntro from "@/components/page-intro";
import StatusBadge from "@/components/workspace/status-badge";
import { fetchSpotifyEditablePlaylist } from "@/lib/spotify-user";

export const dynamic = "force-dynamic";

function coverStyle(coverUrl: string | null) {
  if (!coverUrl) {
    return undefined;
  }

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

  return (
    <div>
      <TopNav title="Editar playlist" />
      <PageIntro
        eyebrow="Curadoria Spotify"
        title={playlist.name}
        description="Painel preparado para editar playlists criadas pela conta Spotify conectada. Nesta fase, o sistema faz a leitura segura da playlist e deixa as acoes prontas para ativacao."
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
                <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Fase 2
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Descricao
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {playlist.description || "Sem descricao cadastrada."}
              </p>
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
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Lista de musicas
            </div>
            <h2 className="mt-2 text-2xl font-semibold">
              Faixas atuais da playlist
            </h2>
          </div>
          <StatusBadge tone="yellow">Edicao em breve</StatusBadge>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
          <table className="min-w-[860px] w-full divide-y divide-border text-left">
            <thead className="bg-muted/20">
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-4 py-3">Musica</th>
                <th className="px-4 py-3">Artistas</th>
                <th className="px-4 py-3">Album</th>
                <th className="px-4 py-3">Pop.</th>
                <th className="px-4 py-3">Duracao</th>
                <th className="px-4 py-3">Spotify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {playlist.tracks.length > 0 ? (
                playlist.tracks.map((track) => (
                  <tr key={track.id} className="hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-11 w-11 shrink-0 rounded-xl border border-border bg-muted"
                          style={coverStyle(track.imageUrl)}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {track.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {track.artists}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {track.albumName}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {track.popularity}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {track.durationLabel}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={track.spotifyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-primary"
                      >
                        Abrir
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    <Music2 className="mx-auto mb-3 h-5 w-5" />
                    Nenhuma faixa encontrada nesta playlist.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Container>
    </div>
  );
}
