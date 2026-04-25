import { SmilePlus, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ScoreBreakdown } from "@/types/dashboard";
import ChartTitle from "../../components/chart-title";
import LinearProgress from "./components/linear-progress";

export default function CustomerSatisfication({
  customerSatisfication,
  totalCustomers,
  title = "Score Health",
  totalLabel = "Playlists Analyzed",
  totalSuffix = "Playlists",
  labels = {
    positive: "High Score",
    neutral: "Medium Score",
    negative: "Low Score",
  },
}: {
  customerSatisfication: ScoreBreakdown;
  totalCustomers: number;
  title?: string;
  totalLabel?: string;
  totalSuffix?: string;
  labels?: {
    positive: string;
    neutral: string;
    negative: string;
  };
}) {
  const customerSatisficationOptions = [
    {
      label: labels.positive,
      color: "#5fb67a",
      percentage: customerSatisfication.positive,
      icon: <ThumbsUp className="h-6 w-6" stroke="#5fb67a" fill="#5fb67a" />,
    },
    {
      label: labels.neutral,
      color: "#f5c36e",
      percentage: customerSatisfication.neutral,
      icon: <ThumbsUp className="h-6 w-6" stroke="#f5c36e" fill="#f5c36e" />,
    },
    {
      label: labels.negative,
      color: "#da6d67",
      percentage: customerSatisfication.negative,
      icon: <ThumbsDown className="h-6 w-6" stroke="#da6d67" fill="#da6d67" />,
    },
  ];

  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title={title} icon={SmilePlus} />
      <div className="my-4 flex h-full items-center justify-between">
        <div className="mx-auto grid w-full grid-cols-2 gap-6">
          <TotalCustomers
            totalCustomers={totalCustomers}
            totalLabel={totalLabel}
            totalSuffix={totalSuffix}
          />
          {customerSatisficationOptions.map((option) => (
            <LinearProgress
              key={option.label}
              label={option.label}
              color={option.color}
              percentage={option.percentage}
              icon={option.icon}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TotalCustomers({
  totalCustomers,
  totalLabel,
  totalSuffix,
}: {
  totalCustomers: number;
  totalLabel: string;
  totalSuffix: string;
}) {
  return (
    <div className="flex flex-col items-start justify-center">
      <div className="text-xs text-muted-foreground">{totalLabel}</div>
      <div className="text-2xl font-medium">
        {totalCustomers} {totalSuffix}
      </div>
    </div>
  );
}
