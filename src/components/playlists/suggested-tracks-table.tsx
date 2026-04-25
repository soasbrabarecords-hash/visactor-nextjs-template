import { ExternalLink, WandSparkles } from "lucide-react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";
import Container from "@/components/container";
import type { SuggestedTrackInsight } from "@/types/playlist-analysis";

export default function SuggestedTracksTable({
  tracks,
}: {
  tracks: SuggestedTrackInsight[];
}) {
  return (
    <Container className="py-4">
      <section className="flex flex-col gap-4">
        <div>
          <ChartTitle title="Sugestoes Relacionadas" icon={WandSparkles} />
          <p className="mt-1 text-sm text-muted-foreground">
            Faixas com match forte com o DNA atual da playlist e potencial de
            curadoria para o momento.
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
                <th className="px-4 py-3 font-medium">Motivo</th>
                <th className="px-4 py-3 font-medium">Spotify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tracks.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    Ainda nao temos sugestoes relacionadas para esta playlist.
                  </td>
                </tr>
              ) : (
                tracks.map((track) => (
                  <tr key={track.id}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {track.coverUrl ? (
                          <div
                            className="h-12 w-12 shrink-0 rounded-xl"
                            style={{
                              backgroundImage: `url(${track.coverUrl})`,
                              backgroundPosition: "center",
                              backgroundSize: "cover",
                            }}
                          />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-xl bg-muted" />
                        )}
                        <div className="font-medium">{track.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">{track.artists}</td>
                    <td className="px-4 py-4 text-sm">{track.albumName}</td>
                    <td className="px-4 py-4 text-sm">{track.popularity}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {track.reason}
                    </td>
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
