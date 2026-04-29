import Link from "next/link";
import { ExternalLink } from "lucide-react";
import Container from "@/components/container";
import { Button } from "@/components/ui/button";
import type { PrimaryAction } from "@/types/workspace";
import StatusBadge from "./status-badge";

function coverStyle(coverUrl: string | null) {
  if (!coverUrl) {
    return undefined;
  }

  return {
    backgroundImage: `url(${coverUrl})`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

export default function PrimaryActionCard({
  action,
}: {
  action: PrimaryAction;
}) {
  return (
    <Container className="border-b border-border py-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Acao principal do dia
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Decisao numero um</h2>
      </div>

      {action.track ? (
        <article className="rounded-[28px] border border-border bg-card/80 p-6 laptop:p-8">
          <div className="grid gap-6 laptop:grid-cols-[120px_1fr_auto] laptop:items-center">
            <div
              className="h-28 w-28 rounded-3xl bg-muted"
              style={coverStyle(action.track.coverUrl)}
            />

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge tone="green">Adicionar agora</StatusBadge>
                <StatusBadge tone={action.track.movement.tone}>
                  {action.track.movement.icon} {action.track.chartDeltaLabel}
                </StatusBadge>
                <StatusBadge tone="yellow">
                  Score {action.track.decisionScore}
                </StatusBadge>
              </div>
              <h3 className="mt-4 text-3xl font-semibold">{action.track.name}</h3>
              <p className="mt-1 text-lg text-muted-foreground">
                {action.track.artists}
              </p>
              <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
                {action.reason}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button>Adicionar agora</Button>
              <Button asChild variant="outline">
                <Link href={action.track.spotifyUrl} target="_blank" rel="noreferrer">
                  Abrir Spotify
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </article>
      ) : (
        <article className="rounded-[28px] border border-border bg-card/80 p-6 text-sm text-muted-foreground">
          Ainda nao existe uma faixa com prioridade maxima definida para hoje.
        </article>
      )}
    </Container>
  );
}
