import Container from "@/components/container";

export default function ArtistOsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-transparent font-sans text-foreground antialiased">
      <Container className="py-5">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm tablet:p-5">
          <div className="flex flex-col gap-4 laptop:flex-row laptop:items-end laptop:justify-between">
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
              <div className="rounded-xl border border-border bg-muted/30 p-3">
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
              <div className="rounded-xl border border-border bg-muted/30 p-3">
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

        <main className="mt-4">{children}</main>
      </Container>
    </div>
  );
}
