import { ExternalLink, ListMusic } from "lucide-react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";
import Container from "@/components/container";
import { addThousandsSeparator } from "@/lib/utils";
import type { PlaylistRecord } from "@/types/dashboard";

export default function PlaylistTable({
  playlists,
}: {
  playlists: PlaylistRecord[];
}) {
  return (
    <Container className="py-4">
      <section className="flex flex-col gap-4">
        <div>
          <ChartTitle title="Playlists Monitoradas" icon={ListMusic} />
          <p className="mt-1 text-sm text-muted-foreground">
            Dados reais do Spotify e do Supabase dentro da estrutura visual do
            dashboard.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full divide-y divide-border text-left">
            <thead className="bg-muted/30">
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Followers</th>
                <th className="px-4 py-3 font-medium">Tracks</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {playlists.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No playlists found in Supabase yet.
                  </td>
                </tr>
              ) : (
                playlists.map((playlist) => (
                  <tr key={playlist.id}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {playlist.coverUrl ? (
                          <div
                            className="h-12 w-12 rounded-xl object-cover"
                            style={{
                              backgroundImage: `url(${playlist.coverUrl})`,
                              backgroundPosition: "center",
                              backgroundSize: "cover",
                            }}
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-muted" />
                        )}
                        <div className="font-medium">{playlist.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {addThousandsSeparator(playlist.followers)}
                    </td>
                    <td className="px-4 py-4 text-sm">{playlist.tracks}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(0, Math.min(playlist.score, 100))}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{playlist.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={playlist.url}
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
