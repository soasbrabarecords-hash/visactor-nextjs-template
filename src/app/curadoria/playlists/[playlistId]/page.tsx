import Link from "next/link";
import { ExternalLink, Music2 } from "lucide-react";
import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import PageIntro from "@/components/page-intro";
import PlaylistEditor from "@/components/workspace/playlist-editor";
import PlaylistKworbSuggestions from "@/components/workspace/playlist-kworb-suggestions";
import {
  fetchSpotifyEditablePlaylist,
  fetchPlaylistSnapshotId,
} from "@/lib/spotify-user";

export const dynamic = "force-dynamic";

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

      {/* ── Spotify-style header ── */}
      <div className="relative overflow-hidden" style={{ minHeight: "320px" }}>
        {/* Background: blurred cover + dark gradient overlay */}
        {playlist.imageUrl && (
          <div
            className="absolute inset-0 scale-110"
            style={{
              backgroundImage: `url(${playlist.imageUrl})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
              filter: "blur(40px) brightness(0.35) saturate(1.4)",
            }}
          />
        )}
        {/* Dark gradient overlay — sempre presente mesmo sem capa */}
        <div
          className="absolute inset-0"
          style={{
            background: playlist.imageUrl
              ? "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)"
              : "linear-gradient(to bottom, hsl(var(--background) / 0.7), hsl(var(--background)))",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-end px-8 pb-8 pt-12 laptop:px-12">
          <div className="flex flex-col gap-6 laptop:flex-row laptop:items-end">

            {/* Cover art */}
            <div className="shrink-0">
              {playlist.imageUrl ? (
                <div
                  className="h-40 w-40 rounded-xl shadow-2xl"
                  style={{
                    backgroundImage: `url(${playlist.imageUrl})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                  }}
                />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-muted shadow-2xl">
                  <Music2 className="h-16 w-16 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1 space-y-2 text-white">
              {/* Label */}
              <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
                {playlist.isPublic ? "Playlist pública" : "Playlist privada"}
                {playlist.isCollaborative ? " · Colaborativa" : ""}
              </p>

              {/* Title */}
              <h1
                className="overflow-hidden text-ellipsis font-bold leading-none tracking-tight"
                style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
              >
                {playlist.name}
              </h1>

              {/* Description */}
              {playlist.description && (
                <p className="max-w-2xl text-sm leading-relaxed opacity-70 line-clamp-2">
                  {playlist.description}
                </p>
              )}

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-1 pt-1 text-sm opacity-80">
                <span className="font-semibold">{playlist.ownerName}</span>
                <span className="opacity-50">·</span>
                <span>{formatCount(playlist.tracksTotal)} faixas</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Link href="/curadoria">Voltar</Link>
              </Button>
              <Button asChild size="sm" className="bg-white text-black hover:bg-white/90">
                <a
                  href={playlist.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  Abrir Spotify
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

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
