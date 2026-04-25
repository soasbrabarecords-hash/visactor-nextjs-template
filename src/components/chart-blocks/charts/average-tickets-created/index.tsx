"use client";

import {
  addDays,
  endOfDay,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { FilePlus2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import type {
  PlaylistActivityProps,
  PlaylistTimelineMetric,
} from "@/types/dashboard";
import ChartTitle from "../../components/chart-title";
import Chart from "./chart";
import { DatePickerWithRange } from "./components/date-range-picker";
import MetricCard from "./components/metric-card";

const calMetricCardValue = (
  data: PlaylistTimelineMetric[],
  type: "created" | "scored",
) => {
  const filteredData = data.filter((item) => item.type === type);

  if (filteredData.length === 0) {
    return 0;
  }

  return Math.round(
    filteredData.reduce((acc, curr) => acc + curr.count, 0) /
      filteredData.length,
  );
};

function flattenMetrics(
  data: PlaylistActivityProps["data"],
): PlaylistTimelineMetric[] {
  return data.flatMap((item) => [
    {
      date: item.date,
      type: "scored" as const,
      count: item.scored,
    },
    {
      date: item.date,
      type: "created" as const,
      count: item.created,
    },
  ]);
}

export default function AverageTicketsCreated({
  data,
}: PlaylistActivityProps) {
  const availableDates = useMemo(() => data.map((item) => item.date), [data]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (availableDates.length === 0) {
      setDateRange(undefined);
      return;
    }

    const lastDate = parseISO(availableDates[availableDates.length - 1]);
    const defaultFromIndex = Math.max(availableDates.length - 7, 0);
    const from = parseISO(availableDates[defaultFromIndex]);

    setDateRange({
      from,
      to: Number.isNaN(lastDate.getTime()) ? addDays(from, 6) : lastDate,
    });
  }, [availableDates]);

  const ticketChartData = useMemo(() => {
    const flattened = flattenMetrics(data);

    if (!dateRange?.from || !dateRange?.to) {
      return flattened;
    }

    const startDate = startOfDay(dateRange.from);
    const endDate = endOfDay(dateRange.to);

    return flattened.filter((item) => {
      const date = parseISO(item.date);
      return isWithinInterval(date, { start: startDate, end: endDate });
    });
  }, [data, dateRange]);

  const avgCreated = calMetricCardValue(ticketChartData, "created");
  const avgResolved = calMetricCardValue(ticketChartData, "scored");

  return (
    <section className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <ChartTitle title="Playlist Activity" icon={FilePlus2} />
        <DatePickerWithRange
          className=""
          dateRange={dateRange}
          setDateRange={setDateRange}
          availableDates={availableDates}
        />
      </div>
      <div className="flex flex-wrap">
        <div className="my-4 flex w-52 shrink-0 flex-col justify-center gap-6">
          <MetricCard
            title="Avg. Added"
            value={avgCreated}
            color="#60C2FB"
          />
          <MetricCard
            title="Avg. Scored"
            value={avgResolved}
            color="#3161F8"
          />
        </div>
        <div className="relative h-96 min-w-[320px] flex-1">
          <Chart data={ticketChartData} />
        </div>
      </div>
    </section>
  );
}
