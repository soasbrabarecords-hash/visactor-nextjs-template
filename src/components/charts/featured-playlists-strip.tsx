import { ExternalLink, Radio } from "lucide-react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";
import type { FeaturedPlaylistInsight } from "@/types/charts";

export default function FeaturedPlaylistsStrip({
  playlists,
}: {
  playlists: FeaturedPlaylistInsight[];
}) {
  return (
    <section className="flex h-full flex-col gap-4">
      <ChartTitle title="Mercado em Movimento" icon={Radio} />
      <p className="text-sm text-muted-foreground">
        Leitura do que esta ganhando destaque agora nas playlists featured do
        Spotify Brasil, independente do seu radar interno.
      </p>

      <div className="grid gap-3">
        {playlists.length === 0 ? (
          <div className="rounded-2xl border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
            Mercado em movimento indisponivel no momento.
          </div>
        ) : (
          playlists.map((playlist) => (
            <a
              key={playlist.id}
              href={playlist.spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-2xl border border-border bg-muted/10 p-3 transition-colors hover:bg-muted/20"
            >
              {playlist.coverUrl ? (
                <div
                  className="h-16 w-16 rounded-xl"
                  style={{
                    backgroundImage: `url(${playlist.coverUrl})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-muted" />
              )}

              <div className="min-w-0">
                <div className="truncate font-medium">{playlist.name}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {playlist.description || "Playlist em destaque do momento."}
                </p>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{playlist.tracksTotal} tracks</span>
                <ExternalLink className="h-4 w-4" />
              </div>
            </a>
          ))
        )}
      </div>
    </section>
  );
}
