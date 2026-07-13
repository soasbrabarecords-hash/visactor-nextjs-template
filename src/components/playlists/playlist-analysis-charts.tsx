"use client";

import dynamic from "next/dynamic";
import Container from "@/components/container";
import { ChartThemeProvider } from "@/components/providers/chart-theme-provider";
import type { ChannelDatum, ScoreBreakdown } from "@/types/dashboard";

type PlaylistAnalysisChartsProps = {
  artistDistribution: ChannelDatum[];
  popularityHealth: ScoreBreakdown;
  totalTracks: number;
};

type TicketByChannelsProps = {
  data: ChannelDatum[];
  title?: string;
  centerLabel?: string;
};

type CustomerSatisficationProps = {
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
};

function ChartSkeleton() {
  return (
    <div className="flex h-64 animate-pulse flex-col gap-4 rounded-2xl border border-border bg-card/60 p-4">
      <div className="h-5 w-40 rounded-full bg-muted" />
      <div className="flex flex-1 items-center justify-center">
        <div className="h-32 w-32 rounded-full bg-muted" />
      </div>
    </div>
  );
}

const TicketByChannels = dynamic<TicketByChannelsProps>(
  () => import("@/components/chart-blocks/charts/ticket-by-channels"),
  {
    loading: ChartSkeleton,
    ssr: false,
  },
);

const CustomerSatisfication = dynamic<CustomerSatisficationProps>(
  () => import("@/components/chart-blocks/charts/customer-satisfication"),
  {
    loading: ChartSkeleton,
    ssr: false,
  },
);

export default function PlaylistAnalysisCharts({
  artistDistribution,
  popularityHealth,
  totalTracks,
}: PlaylistAnalysisChartsProps) {
  return (
    <ChartThemeProvider>
      <Container className="py-4 laptop:col-span-1">
        <TicketByChannels
          data={artistDistribution}
          title="Artist DNA"
          centerLabel="Artistas dominantes"
        />
      </Container>

      <Container className="py-4 laptop:col-span-1">
        <CustomerSatisfication
          customerSatisfication={popularityHealth}
          totalCustomers={totalTracks}
          title="Faixa Health"
          totalLabel="Faixas atuais"
          totalSuffix="tracks"
          labels={{
            positive: "Alta tracao",
            neutral: "Media tracao",
            negative: "Baixa tracao",
          }}
        />
      </Container>
    </ChartThemeProvider>
  );
}
