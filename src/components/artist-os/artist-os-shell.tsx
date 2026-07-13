import Container from "@/components/container";

export default function ArtistOsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[radial-gradient(circle_at_82%_0%,rgba(14,165,233,0.10),transparent_30%),hsl(var(--background))] font-sans text-foreground antialiased dark:bg-[radial-gradient(circle_at_82%_0%,rgba(56,189,248,0.10),transparent_30%),hsl(var(--background))]">
      <Container className="py-5">
        <section className="relative overflow-hidden rounded-[30px] border border-border/70 bg-card/75 p-4 shadow-[0_22px_70px_-54px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:bg-card/[0.68] dark:shadow-[0_24px_80px_-58px_rgba(0,0,0,0.9)] tablet:p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/35 to-transparent" />

          <div className="relative flex flex-col gap-4 laptop:flex-row laptop:items-end laptop:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-sky-500/20 bg-sky-500/[0.07] px-3 py-1 text-xs font-medium text-sky-700 dark:text-sky-200">
                Business OS
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-foreground tablet:text-4xl">
                Gestão de carreira
              </h1>
              <p className="mt-1.5 max-w-3xl text-sm font-normal leading-6 text-muted-foreground tablet:text-base">
                Operação completa para carreiras: agenda, oportunidades, publi,
                caixa, contratos e equipe no mesmo painel.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 laptop:w-[380px]">
              <div className="rounded-[20px] border border-border/70 bg-background/60 p-3 backdrop-blur">
                <div className="text-xs font-medium text-muted-foreground">
                  Operação
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  Shows + contratos
                </div>
                <div className="text-xs font-normal text-muted-foreground">
                  Controle comercial e agenda.
                </div>
              </div>
              <div className="rounded-[20px] border border-border/70 bg-background/60 p-3 backdrop-blur">
                <div className="text-xs font-medium text-muted-foreground">
                  Caixa
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  Financeiro por artista
                </div>
                <div className="text-xs font-normal text-muted-foreground">
                  Entradas, saídas e atrasos.
                </div>
              </div>
            </div>
          </div>
        </section>

        <main className="mt-5">{children}</main>
      </Container>
    </div>
  );
}
