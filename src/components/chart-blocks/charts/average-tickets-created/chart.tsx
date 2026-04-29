"use client";

import { VChart } from "@visactor/react-vchart";
import type { IBarChartSpec } from "@visactor/vchart";
import type { PlaylistTimelineMetric } from "@/types/dashboard";

const generateSpec = (data: PlaylistTimelineMetric[]): IBarChartSpec => ({
  type: "bar",
  data: [
    {
      id: "barData",
      values: data,
    },
  ],
  xField: "date",
  yField: "count",
  seriesField: "type",
  padding: [10, 0, 10, 0],
  legends: {
    visible: false,
  },
  stack: false,
  tooltip: {
    trigger: ["click", "hover"],
  },
  bar: {
    state: {
      hover: {
        outerBorder: {
          distance: 2,
          lineWidth: 2,
        },
      },
    },
    style: {
      cornerRadius: [12, 12, 12, 12],
      zIndex: (datum) => {
        return datum.type === "scored" ? 2 : 1;
      },
    },
  },
});

export default function Chart({ data }: { data: PlaylistTimelineMetric[] }) {
  const spec = generateSpec(data);
  return <VChart spec={spec} />;
}
