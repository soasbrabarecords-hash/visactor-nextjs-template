import { Rss } from "lucide-react";
import type { ChannelDatum } from "@/types/dashboard";
import ChartTitle from "../../components/chart-title";
import Chart from "./chart";

export default function TicketByChannels({
  data,
  title = "Score Distribution",
  centerLabel = "Total Playlists",
}: {
  data: ChannelDatum[];
  title?: string;
  centerLabel?: string;
}) {
  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title={title} icon={Rss} />
      <div className="relative flex min-h-64 flex-grow flex-col justify-center">
        <Chart data={data} centerLabel={centerLabel} />
      </div>
    </section>
  );
}
