import { Sparkles } from "lucide-react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";

export default function InsightPanel({
  analyzedPlaylists,
  topRepeatedTrack,
  explicitShare,
  marketHighlight,
  sharedMomentumCount,
}: {
  analyzedPlaylists: number;
  topRepeatedTrack: string;
  explicitShare: string;
  marketHighlight: string;
  sharedMomentumCount: number;
}) {
  return (
    <section className="flex h-full flex-col gap-4">
      <ChartTitle title="Charts Intelligence" icon={Sparkles} />

      <div className="grid gap-3">
        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Playlists analisadas
          </div>
          <div className="mt-2 text-2xl font-medium">
            {analyzedPlaylists} playlists
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Faixa com maior repeticao
          </div>
          <div className="mt-2 text-lg font-medium">{topRepeatedTrack}</div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Share de explicit
          </div>
          <div className="mt-2 text-2xl font-medium">{explicitShare}</div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Shared momentum
          </div>
          <div className="mt-2 text-2xl font-medium">
            {sharedMomentumCount} faixas
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {marketHighlight}
          </p>
        </div>
      </div>
    </section>
  );
}
