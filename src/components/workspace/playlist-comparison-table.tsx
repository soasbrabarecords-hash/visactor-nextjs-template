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
      <section className="rounded-[32px] border border-white/70 bg-white/[0.66] p-4 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.035] dark:shadow-[0_24px_90px_rgba(0,0,0,0.28)] tablet:p-5">
        <div className="mb-5">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Performance comparativa
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Top playlists por eficiencia
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Compare score, repeticao de faixas, media de popularidade e crescimento
            de seguidores para entender quais playlists estao puxando a base.
          </p>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-border/80 bg-background/[0.72] shadow-inner shadow-slate-950/[0.03] dark:border-white/10 dark:bg-black/[0.18]">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full divide-y divide-border/70 text-left">
          <thead className="bg-muted/35 dark:bg-white/[0.035]">
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
                <tr
                  key={row.playlistId}
                  className="transition-colors hover:bg-violet-500/[0.055] dark:hover:bg-white/[0.035]"
                >
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
      </div>
      </section>
    </Container>
  );
}
