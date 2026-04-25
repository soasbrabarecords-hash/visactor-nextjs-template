import { Sparkles } from "lucide-react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";

export default function CuratorNotesPanel({
  notes,
  overlapWithMarket,
}: {
  notes: string[];
  overlapWithMarket: number;
}) {
  return (
    <section className="flex h-full flex-col gap-4">
      <ChartTitle title="Leitura de Curadoria" icon={Sparkles} />

      <div className="rounded-2xl border border-border bg-muted/10 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Overlap com mercado
        </div>
        <div className="mt-2 text-2xl font-medium">
          {overlapWithMarket} faixas
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-muted/10 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Diagnostico
        </div>
        <div className="mt-3 flex flex-col gap-3 text-sm text-muted-foreground">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
