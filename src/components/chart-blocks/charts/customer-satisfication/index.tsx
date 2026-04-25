import { SmilePlus, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ScoreBreakdown } from "@/types/dashboard";
import ChartTitle from "../../components/chart-title";
import LinearProgress from "./components/linear-progress";

export default function CustomerSatisfication({
  customerSatisfication,
  totalCustomers,
}: {
  customerSatisfication: ScoreBreakdown;
  totalCustomers: number;
}) {
  const customerSatisficationOptions = [
    {
      label: "High Score",
      color: "#5fb67a",
      percentage: customerSatisfication.positive,
      icon: <ThumbsUp className="h-6 w-6" stroke="#5fb67a" fill="#5fb67a" />,
    },
    {
      label: "Medium Score",
      color: "#f5c36e",
      percentage: customerSatisfication.neutral,
      icon: <ThumbsUp className="h-6 w-6" stroke="#f5c36e" fill="#f5c36e" />,
    },
    {
      label: "Low Score",
      color: "#da6d67",
      percentage: customerSatisfication.negative,
      icon: <ThumbsDown className="h-6 w-6" stroke="#da6d67" fill="#da6d67" />,
    },
  ];

  return (
    <section className="flex h-full flex-col gap-2">
      <ChartTitle title="Score Health" icon={SmilePlus} />
      <div className="my-4 flex h-full items-center justify-between">
        <div className="mx-auto grid w-full grid-cols-2 gap-6">
          <TotalCustomers totalCustomers={totalCustomers} />
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

function TotalCustomers({ totalCustomers }: { totalCustomers: number }) {
  return (
    <div className="flex flex-col items-start justify-center">
      <div className="text-xs text-muted-foreground">Playlists Analyzed</div>
      <div className="text-2xl font-medium">{totalCustomers} Playlists</div>
    </div>
  );
}
