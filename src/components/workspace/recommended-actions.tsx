import Container from "@/components/container";
import type { RecommendedAction } from "@/types/workspace";
import StatusBadge from "./status-badge";

export default function RecommendedActions({
  actions,
}: {
  actions: RecommendedAction[];
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Acoes recomendadas
        </div>
        <h2 className="mt-2 text-2xl font-semibold">O que fazer hoje</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Organizado para voce decidir rapido: o que entra agora, o que merece
          observacao e o que ja pede ajuste.
        </p>
      </div>

      <div className="grid gap-4 desktop:grid-cols-3">
        {actions.map((action) => (
          <article
            key={action.title}
            className="rounded-2xl border border-border bg-card/70 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{action.title}</h3>
              <StatusBadge tone={action.tone}>{action.title}</StatusBadge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{action.summary}</p>
            <ul className="mt-4 space-y-3">
              {action.items.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-border/80 bg-background/40 px-3 py-3 text-sm"
                >
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Container>
  );
}
