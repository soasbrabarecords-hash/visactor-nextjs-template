import { ArrowUpRight, Flame } from "lucide-react";
import ChartTitle from "@/components/chart-blocks/components/chart-title";
import Container from "@/components/container";
import type { MusicTrackHighlight } from "@/types/music-charts";

export default function MusicTrackGrid({
  title,
  description,
  tracks,
  emptyMessage,
}: {
  title: string;
  description: string;
  tracks: MusicTrackHighlight[];
  emptyMessage: string;
}) {
  return (
    <Container className="py-4">
      <section className="flex h-full flex-col gap-4">
        <div>
          <ChartTitle title={title} icon={Flame} />
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        {tracks.length === 0 ? (
          <div className="rounded-2xl border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="grid gap-3">
            {tracks.map((track) => (
              <a
                key={track.id}
                href={track.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-2xl border border-border bg-muted/10 p-3 transition-colors hover:bg-muted/20"
              >
                {track.coverUrl ? (
                  <div
                    className="h-16 w-16 rounded-xl"
                    style={{
                      backgroundImage: `url(${track.coverUrl})`,
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                    }}
                  />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-muted" />
                )}

                <div className="min-w-0">
                  <div className="truncate font-medium">{track.name}</div>
                  <p className="truncate text-sm text-muted-foreground">
                    {track.artists}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {track.summary}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground">
                    {track.primaryMetric}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {track.secondaryMetric}
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}
