import Container from "@/components/container";
import { cn } from "@/lib/utils";
import type { RecommendedAction } from "@/types/workspace";
import StatusBadge from "./status-badge";

const toneCardClasses = {
  green: "border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(9,13,11,0.96))] text-white",
  red: "border-red-500/20 bg-[linear-gradient(180deg,rgba(248,113,113,0.12),rgba(13,9,9,0.96))] text-white",
  yellow: "border-amber-500/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.14),rgba(15,12,9,0.96))] text-white",
  blue: "border-sky-500/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.14),rgba(9,12,15,0.96))] text-white",
  purple: "border-violet-500/20 bg-[linear-gradient(180deg,rgba(167,139,250,0.14),rgba(11,9,15,0.96))] text-white",
  slate: "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(12,13,16,0.96))] text-white",
} as const;

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
            className={cn(
              "rounded-[26px] border p-5 shadow-[0_18px_44px_rgba(0,0,0,0.18)]",
              toneCardClasses[action.tone],
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{action.title}</h3>
              <StatusBadge tone={action.tone}>{action.title}</StatusBadge>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/70">{action.summary}</p>
            <ul className="mt-4 space-y-3">
              {action.items.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white/80"
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
