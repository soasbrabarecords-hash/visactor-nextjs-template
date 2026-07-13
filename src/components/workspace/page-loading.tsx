import Container from "@/components/container";
import { TopNav } from "@/components/nav";
import {
  AudioWaveform,
  ChartNoAxesCombined,
  ListMusic,
  Sparkles,
} from "lucide-react";

export default function PageLoading({ title }: { title: string }) {
  return (
    <div>
      <TopNav title={title} />
      <main
        className="relative isolate min-h-[calc(100dvh-4rem)] overflow-hidden border-b border-border bg-background"
        role="status"
        aria-live="polite"
        aria-label={`Carregando ${title}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,hsl(var(--primary)/0.14),transparent_30%),radial-gradient(circle_at_86%_28%,hsl(166_72%_48%/0.10),transparent_28%)]" />
        <div className="page-loading-ambient pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="page-loading-ambient page-loading-ambient-delayed pointer-events-none absolute -right-24 top-48 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

        <Container className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-center py-8 tablet:py-12">
          <section className="mx-auto w-full max-w-4xl overflow-hidden rounded-[30px] border border-border/80 bg-card/75 shadow-[0_30px_90px_hsl(222_47%_5%/0.14)] backdrop-blur-2xl dark:bg-card/70">
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5 tablet:px-7">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/65 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <span className="page-loading-status-dot h-1.5 w-1.5 rounded-full bg-primary" />
                Preparando ambiente
              </div>
            </div>

            <div className="grid items-center gap-8 px-6 py-9 tablet:grid-cols-[1fr_250px] tablet:px-10 tablet:py-11 laptop:grid-cols-[1fr_280px]">
              <div className="max-w-xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Music Business OS
                </div>
                <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] text-foreground tablet:text-4xl">
                  Organizando {title}
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground tablet:text-[15px]">
                  Sincronizando sinais e preparando as próximas ações para você
                  entrar direto no que importa.
                </p>

                <div className="mt-7 overflow-hidden rounded-full bg-muted/80 p-1 ring-1 ring-border/60">
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-primary/10">
                    <span className="page-loading-progress absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2.5 text-xs text-muted-foreground">
                  {[
                    { label: "Dados", icon: ListMusic, delay: "0ms" },
                    { label: "Inteligência", icon: ChartNoAxesCombined, delay: "350ms" },
                    { label: "Ações", icon: Sparkles, delay: "700ms" },
                  ].map(({ label, icon: Icon, delay }) => (
                    <span
                      key={label}
                      className="page-loading-stage inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/55 px-3 py-2"
                      style={{ animationDelay: delay }}
                    >
                      <Icon className="h-3.5 w-3.5 text-primary" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative mx-auto flex h-[220px] w-[220px] items-center justify-center tablet:h-[240px] tablet:w-[240px]">
                <div className="page-loading-orbit absolute inset-1 rounded-full border border-primary/20">
                  <span className="absolute left-1/2 top-[-5px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.75)]" />
                </div>
                <div className="page-loading-orbit-reverse absolute inset-8 rounded-full border border-dashed border-border">
                  <span className="absolute bottom-[12%] right-[3%] h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgb(52_211_153/0.7)]" />
                </div>
                <div className="absolute inset-[72px] rounded-full bg-primary/15 blur-2xl" />
                <div className="page-loading-core relative flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/50 bg-gradient-to-br from-primary via-blue-600 to-violet-600 text-white shadow-[0_20px_50px_hsl(var(--primary)/0.32)] dark:border-white/10">
                  <AudioWaveform className="h-10 w-10" strokeWidth={1.7} />
                </div>
                <span className="page-loading-signal absolute left-[16%] top-[24%] h-2 w-2 rounded-full bg-primary/70" />
                <span className="page-loading-signal page-loading-signal-delayed absolute bottom-[21%] right-[14%] h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
            </div>
          </section>

          <div className="mx-auto mt-4 grid w-full max-w-4xl grid-cols-3 gap-2.5 tablet:gap-4" aria-hidden="true">
            {[AudioWaveform, ChartNoAxesCombined, Sparkles].map((Icon, index) => (
              <div
                key={index}
                className="page-loading-preview flex h-16 items-center gap-3 rounded-2xl border border-border/65 bg-card/45 px-3.5 backdrop-blur-xl tablet:h-20 tablet:px-5"
                style={{ animationDelay: `${index * 220}ms` }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary tablet:h-9 tablet:w-9">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block h-1.5 w-3/5 rounded-full bg-foreground/10" />
                  <span className="block h-1.5 w-full rounded-full bg-muted" />
                </span>
              </div>
            ))}
          </div>
          <span className="sr-only">A página {title} está sendo preparada.</span>
        </Container>
      </main>
    </div>
  );
}
