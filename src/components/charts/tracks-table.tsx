import { ExternalLink, ListMusic } from "lucide-react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";
import Container from "@/components/container";
import type { TrackInsight } from "@/types/charts";

export default function TracksTable({ tracks }: { tracks: TrackInsight[] }) {
  return (
    <Container className="py-4">
      <section className="flex flex-col gap-4">
        <div>
          <ChartTitle title="Top Faixas do Radar" icon={ListMusic} />
          <p className="mt-1 text-sm text-muted-foreground">
            Ranking das musicas mais fortes dentro das playlists monitoradas,
            com base em repeticao, popularidade e presenca editorial.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full divide-y divide-border text-left">
            <thead className="bg-muted/30">
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Faixa</th>
                <th className="px-4 py-3 font-medium">Artistas</th>
                <th className="px-4 py-3 font-medium">Album</th>
                <th className="px-4 py-3 font-medium">Popularidade</th>
                <th className="px-4 py-3 font-medium">Playlists</th>
                <th className="px-4 py-3 font-medium">Duracao</th>
                <th className="px-4 py-3 font-medium">Spotify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tracks.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Adicione playlists com URL do Spotify para liberar a analise
                    de charts.
                  </td>
                </tr>
              ) : (
                tracks.map((track) => (
                  <tr key={track.id}>
                    <td className="px-4 py-4 font-medium">{track.name}</td>
                    <td className="px-4 py-4 text-sm">{track.artists}</td>
                    <td className="px-4 py-4 text-sm">{track.albumName}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.max(0, Math.min(track.popularity, 100))}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {track.popularity}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">{track.playlistsCount}</td>
                    <td className="px-4 py-4 text-sm">{track.durationLabel}</td>
                    <td className="px-4 py-4">
                      <a
                        href={track.spotifyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Abrir
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Container>
  );
}
