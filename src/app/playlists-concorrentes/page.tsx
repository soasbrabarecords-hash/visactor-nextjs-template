import AddPlaylistForm from "@/components/dashboard/add-playlist-form";
import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import CompetitorPlaylistsTable from "@/components/workspace/competitor-playlists-table";
import PlaylistComparisonTable from "@/components/workspace/playlist-comparison-table";
import RadarPlaylistsTable from "@/components/workspace/radar-playlists-table";
import StatusBadge from "@/components/workspace/status-badge";
import {
  getBasePlaylistsPageData,
  getRadarPlaylistsPageData,
} from "@/lib/workspace-data";
import { Activity, BarChart3, ListMusic, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PlaylistsAnalyticsPage() {
  const [baseData, radarData] = await Promise.all([
    getBasePlaylistsPageData(),
    getRadarPlaylistsPageData(),
  ]);
  const strongCompetitors = baseData.rows.filter(
    (row) => row.playlist.score >= 80,
  ).length;
  const updateSignals =
    radarData.sharedMomentum.length > 0
      ? radarData.sharedMomentum
      : radarData.rows.slice(0, 6);
  const topPlaylists = baseData.rows.slice(0, 3);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.10),transparent_26%),radial-gradient(circle_at_90%_0%,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]">
      <TopNav title="Playlists Analytics" />
      <Container className="border-b border-border py-6">
        <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-white/[0.72] p-5 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_28px_110px_rgba(0,0,0,0.35)] tablet:p-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.95),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(56,189,248,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.28),rgba(255,255,255,0.04))] dark:bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(56,189,248,0.12),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015))]" />
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-300/[0.24] blur-3xl dark:bg-emerald-400/[0.12]" />
          <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10" />

          <div className="relative grid gap-8 laptop:grid-cols-[1.12fr_0.88fr] laptop:items-stretch">
            <div className="flex min-h-[330px] flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="blue">Playlists Analytics</StatusBadge>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/[0.55] px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Signal room
                  </span>
                </div>
                <h2 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-foreground tablet:text-5xl">
                  Leia o mercado de playlists sem perder o controle da sua curadoria.
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground tablet:text-base">
                  Monitore playlists de referencia, compare forca de audiencia e encontre sinais de repertorio antes de decidir o que testar nas suas proprias bases.
                </p>
              </div>

              <div className="mt-7 grid gap-3 tablet:grid-cols-3">
                <article className="rounded-[24px] border border-border/70 bg-background/[0.55] p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <ListMusic className="h-4 w-4" />
                    Monitoradas
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{baseData.rows.length}</div>
                  <p className="mt-1 text-sm text-muted-foreground">Playlists no radar.</p>
                </article>
                <article className="rounded-[24px] border border-border/70 bg-background/[0.55] p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <BarChart3 className="h-4 w-4" />
                    Score 80+
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{strongCompetitors}</div>
                  <p className="mt-1 text-sm text-muted-foreground">Referencias fortes.</p>
                </article>
                <article className="rounded-[24px] border border-border/70 bg-background/[0.55] p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <Activity className="h-4 w-4" />
                    Sinais
                  </div>
                  <div className="mt-3 text-3xl font-semibold">{updateSignals.length}</div>
                  <p className="mt-1 text-sm text-muted-foreground">Faixas em leitura.</p>
                </article>
              </div>
            </div>

            <aside className="relative overflow-hidden rounded-[30px] border border-border/70 bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] dark:border-white/10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.24),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.20),transparent_34%)]" />
              <div className="relative">
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">Live board</div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Top referencias agora</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  Uma leitura rapida das playlists com mais peso para orientar sua proxima decisao.
                </p>

                <div className="mt-5 space-y-3">
                  {topPlaylists.length > 0 ? (
                    topPlaylists.map((row, index) => (
                      <div
                        key={row.playlist.id}
                        className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.055] p-3 backdrop-blur-xl"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sm font-semibold text-white/72">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{row.playlist.name}</div>
                          <div className="mt-1 truncate text-xs text-white/48">
                            {row.followersLabel} seguidores - {row.tracksLabel} faixas
                          </div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-semibold">
                          {row.scoreLabel}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-white/14 bg-white/[0.035] px-4 py-8 text-center text-sm text-white/52">
                      Adicione playlists para ativar o board.
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </Container>

      <AddPlaylistForm
        title="Adicionar playlist para analise"
        description="Cole a URL de uma playlist do Spotify para monitorar audiencia, tamanho, score e repertorio em um so painel."
        buttonLabel="Adicionar playlist"
      />

      <CompetitorPlaylistsTable rows={baseData.rows} />
      <RadarPlaylistsTable
        rows={updateSignals}
        title="O que o mercado esta reforcando"
        description="Faixas que aparecem como padrao de repertorio e ajudam a indicar o que observar, testar ou evitar nas suas playlists."
      />
      <PlaylistComparisonTable rows={baseData.comparisonRows} />
    </div>
  );
}
