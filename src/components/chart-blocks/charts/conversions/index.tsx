import { CirclePercent } from "lucide-react";
import type { ConversionDatum } from "@/types/dashboard";
import { addThousandsSeparator } from "@/lib/utils";
import ChartTitle from "../../components/chart-title";
import Chart from "./chart";

export default function Convertions({ data }: { data: ConversionDatum[] }) {
  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="Followers Leaders" icon={CirclePercent} />
      <Indicator data={data} />
      <div className="relative max-h-80 flex-grow">
        <Chart data={data} />
      </div>
    </section>
  );
}

function Indicator({ data }: { data: ConversionDatum[] }) {
  return (
    <div className="mt-3">
      <span className="mr-1 text-2xl font-medium">
        {addThousandsSeparator(data.reduce((acc, curr) => acc + curr.value, 0))}
      </span>
      <span className="text-muted-foreground/60">Followers</span>
    </div>
  );
}
