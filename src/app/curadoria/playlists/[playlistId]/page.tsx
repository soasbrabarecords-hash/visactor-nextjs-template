import Link from "next/link";
import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import PageIntro from "@/components/page-intro";
import PlaylistEditor from "@/components/workspace/playlist-editor";
import PlaylistHeader from "@/components/workspace/playlist-header";
import PlaylistKworbSuggestions from "@/components/workspace/playlist-kworb-suggestions";
import PlaylistTrackSearch from "@/components/workspace/playlist-track-search";
import {
  fetchSpotifyEditablePlaylist,
  fetchPlaylistSnapshotId,
} from "@/lib/spotify-user";

export const dynamic = "force-dynamic";

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

      {/* Header estilo Spotify com edição inline de capa, nome e descrição */}
      <PlaylistHeader
        playlistId={playlistId}
        initialName={playlist.name}
        initialDescription={playlist.description}
        imageUrl={playlist.imageUrl}
        ownerName={playlist.ownerName}
        tracksTotal={playlist.tracksTotal}
        isPublic={Boolean(playlist.isPublic)}
        isCollaborative={Boolean(playlist.isCollaborative)}
        spotifyUrl={playlist.spotifyUrl}
      />

      <Container className="border-b border-border py-6">
        <PlaylistEditor
          playlistId={playlistId}
          initialTracks={playlist.tracks}
          initialSnapshotId={snapshotId}
        />

        {/* Search de tracks + sugestões (estilo Spotify, abaixo da tabela) */}
        <PlaylistTrackSearch
          playlistId={playlistId}
          existingTrackIds={playlist.tracks.map((t) => t.id)}
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
