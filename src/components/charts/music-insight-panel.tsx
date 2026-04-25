import { Sparkles } from "lucide-react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";

export default function MusicInsightPanel({
  countryLabel,
  genreLabel,
  topTrackName,
  explicitShare,
  marketHighlight,
  sourcePlaylistsCount,
}: {
  countryLabel: string;
  genreLabel: string;
  topTrackName: string;
  explicitShare: string;
  marketHighlight: string;
  sourcePlaylistsCount: number;
}) {
  return (
    <section className="flex h-full flex-col gap-4">
      <ChartTitle title="Charts Music Intelligence" icon={Sparkles} />

      <div className="grid gap-3">
        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Mercado ativo
          </div>
          <div className="mt-2 text-2xl font-medium">{countryLabel}</div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Foco de genero
          </div>
          <div className="mt-2 text-lg font-medium">{genreLabel}</div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Faixa lider agora
          </div>
          <div className="mt-2 text-lg font-medium">{topTrackName}</div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Share de explicit
          </div>
          <div className="mt-2 text-2xl font-medium">{explicitShare}</div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/10 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Playlists fonte
          </div>
          <div className="mt-2 text-2xl font-medium">
            {sourcePlaylistsCount} playlists
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {marketHighlight}
          </p>
        </div>
      </div>
    </section>
  );
}
