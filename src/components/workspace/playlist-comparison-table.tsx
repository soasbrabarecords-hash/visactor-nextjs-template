import Container from "@/components/container";
import StatusBadge from "./status-badge";

export default function PlaylistComparisonTable({
  rows,
}: {
  rows: Array<{
    playlistId: string;
    playlistName: string;
    coverUrl: string | null;
    scoreAverageLabel: string;
    repetitionRateLabel: string;
    averagePopularityLabel: string;
    followerGrowthLabel: string;
    followerGrowthTone: "green" | "red" | "blue" | "purple" | "yellow" | "slate";
    performanceLabel: string;
  }>;
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Analise comparativa
        </div>
        <h2 className="mt-2 text-2xl font-semibold">
          Top playlists por performance
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Compare score, repeticao de faixas, media de popularidade e crescimento
          de seguidores para entender quais playlists estao puxando a base.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
        <table className="min-w-[980px] w-full divide-y divide-border text-left">
          <thead className="bg-muted/20">
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-3">Playlist</th>
              <th className="px-4 py-3">Score medio</th>
              <th className="px-4 py-3">Repeticao</th>
              <th className="px-4 py-3">Popularidade media</th>
              <th className="px-4 py-3">Crescimento</th>
              <th className="px-4 py-3">Performance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Ainda nao ha comparacao suficiente entre playlists.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.playlistId} className="hover:bg-muted/10">
                  <td className="px-4 py-4 font-semibold">{row.playlistName}</td>
                  <td className="px-4 py-4 text-sm">{row.scoreAverageLabel}</td>
                  <td className="px-4 py-4 text-sm">{row.repetitionRateLabel}</td>
                  <td className="px-4 py-4 text-sm">{row.averagePopularityLabel}</td>
                  <td className="px-4 py-4">
                    <StatusBadge tone={row.followerGrowthTone}>
                      {row.followerGrowthLabel}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold">
                    {row.performanceLabel}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Container>
  );
}
