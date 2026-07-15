import "server-only";
import { getHistoricalSpotifyChartSourceReadiness } from "@/lib/charts/spotify-chart-source";
import { createAdminClient } from "@/lib/supabase/admin";

export const SPOTIFY_CHART_BACKFILL_ROLLOUT_KEY =
  "spotify-charts-historical-v1";

export const SPOTIFY_CHART_BACKFILL_PHASES = [
  {
    key: "core-30d",
    order: 10,
    name: "BR + Global — 30 dias",
    windowDays: 30,
    regionIds: ["BR", "GLOBAL"],
  },
  {
    key: "core-60d",
    order: 20,
    name: "BR + Global — 60 dias",
    windowDays: 60,
    regionIds: ["BR", "GLOBAL"],
  },
  {
    key: "core-79d",
    order: 25,
    name: "BR + Global — 79 dias",
    windowDays: 79,
    regionIds: ["BR", "GLOBAL"],
  },
  {
    key: "core-180d",
    order: 30,
    name: "BR + Global — 6 meses",
    windowDays: 180,
    regionIds: ["BR", "GLOBAL"],
  },
  {
    key: "core-365d",
    order: 40,
    name: "BR + Global — 1 ano",
    windowDays: 365,
    regionIds: ["BR", "GLOBAL"],
  },
  {
    key: "core-730d",
    order: 50,
    name: "BR + Global — 2 anos",
    windowDays: 730,
    regionIds: ["BR", "GLOBAL"],
  },
  {
    key: "core-1095d",
    order: 60,
    name: "BR + Global — 3 anos",
    windowDays: 1095,
    regionIds: ["BR", "GLOBAL"],
  },
  {
    key: "cities-30d",
    order: 70,
    name: "SP + RJ + Porto Alegre — 30 dias",
    windowDays: 30,
    regionIds: [
      "BR-SP-SAO-PAULO",
      "BR-RJ-RIO-DE-JANEIRO",
      "BR-RS-PORTO-ALEGRE",
    ],
  },
  {
    key: "cities-180d",
    order: 80,
    name: "SP + RJ + Porto Alegre — 6 meses",
    windowDays: 180,
    regionIds: [
      "BR-SP-SAO-PAULO",
      "BR-RJ-RIO-DE-JANEIRO",
      "BR-RS-PORTO-ALEGRE",
    ],
  },
] as const;

export type SpotifyChartBackfillPhaseKey =
  (typeof SPOTIFY_CHART_BACKFILL_PHASES)[number]["key"];

export type SpotifyChartBackfillCampaignStatus =
  | "locked"
  | "ready"
  | "running"
  | "paused"
  | "completed"
  | "blocked"
  | "cancelled";

export type SpotifyChartBackfillCampaign = {
  id: string;
  rollout_key: string;
  phase_key: SpotifyChartBackfillPhaseKey;
  phase_order: number;
  name: string;
  chart_type: string;
  period: string;
  window_days: number;
  target_start_date: string | null;
  target_end_date: string | null;
  status: SpotifyChartBackfillCampaignStatus;
  expected_job_count: number;
  linked_job_count: number;
  covered_job_count: number;
  pending_job_count: number;
  retry_pending_job_count: number;
  running_job_count: number;
  success_job_count: number;
  failed_job_count: number;
  skipped_job_count: number;
  progress_percent: number;
  last_error: string | null;
  last_evaluated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

const CAMPAIGN_COLUMNS =
  "id,rollout_key,phase_key,phase_order,name,chart_type,period,window_days,target_start_date,target_end_date,status,expected_job_count,linked_job_count,covered_job_count,pending_job_count,retry_pending_job_count,running_job_count,success_job_count,failed_job_count,skipped_job_count,progress_percent,last_error,last_evaluated_at,started_at,completed_at,approved_at,created_at,updated_at";

function requireCampaignAdmin() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for Spotify Charts campaigns.",
    );
  }

  return admin;
}

export function getSpotifyChartBackfillPhaseDefinition(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    SPOTIFY_CHART_BACKFILL_PHASES.find((phase) => phase.key === normalized) ??
    null
  );
}

export function isCoreSpotifyChartBackfillPhase(
  phase: (typeof SPOTIFY_CHART_BACKFILL_PHASES)[number],
) {
  return phase.regionIds.every(
    (regionId) => regionId === "BR" || regionId === "GLOBAL",
  );
}

function getLatestCompletedUtcDate(now: Date) {
  const latest = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  latest.setUTCDate(latest.getUTCDate() - 1);
  return latest;
}

export function planSpotifyChartBackfillPhase(
  phaseKey: string,
  now = new Date(),
  anchorEndDate?: string | null,
) {
  const phase = getSpotifyChartBackfillPhaseDefinition(phaseKey);
  if (!phase) return null;

  const latestCompletedDate = getLatestCompletedUtcDate(now);
  const parsedAnchor = anchorEndDate
    ? new Date(`${anchorEndDate}T00:00:00.000Z`)
    : null;

  if (
    parsedAnchor &&
    (Number.isNaN(parsedAnchor.getTime()) ||
      parsedAnchor.toISOString().slice(0, 10) !== anchorEndDate ||
      parsedAnchor > latestCompletedDate)
  ) {
    throw new Error("A data ancora do rollout deve ser um dia UTC concluido.");
  }

  const end = parsedAnchor ?? latestCompletedDate;
  const dates = Array.from({ length: phase.windowDays }, (_value, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - index);
    return date.toISOString().slice(0, 10);
  });
  const sourceReadiness = getHistoricalSpotifyChartSourceReadiness(
    phase.regionIds,
  );

  return {
    phaseKey: phase.key,
    phaseOrder: phase.order,
    name: phase.name,
    windowDays: phase.windowDays,
    regionIds: [...phase.regionIds],
    startDate: dates.at(-1) ?? null,
    endDate: dates[0] ?? null,
    expectedJobs: dates.length * phase.regionIds.length,
    dates,
    sourceReadiness,
    sourceReady: sourceReadiness.every(
      (source) => source.supportsHistoricalDates,
    ),
  };
}

export async function getSpotifyChartBackfillCampaigns() {
  const admin = requireCampaignAdmin();
  const { data, error } = await admin
    .from("spotify_chart_backfill_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("rollout_key", SPOTIFY_CHART_BACKFILL_ROLLOUT_KEY)
    .order("phase_order", { ascending: true });

  if (error) {
    throw new Error(`Nao foi possivel ler as campanhas: ${error.message}`);
  }

  return (data ?? []) as SpotifyChartBackfillCampaign[];
}

export function getSpotifyChartBackfillRolloutAnchorEndDate(
  campaigns: readonly Pick<
    SpotifyChartBackfillCampaign,
    "rollout_key" | "phase_order" | "target_end_date"
  >[],
) {
  return (
    campaigns
      .filter(
        (campaign) =>
          campaign.rollout_key === SPOTIFY_CHART_BACKFILL_ROLLOUT_KEY &&
          campaign.target_end_date,
      )
      .sort((left, right) => left.phase_order - right.phase_order)[0]
      ?.target_end_date ?? null
  );
}

export async function refreshSpotifyChartBackfillCampaignProgress(
  phaseKey?: string,
) {
  const admin = requireCampaignAdmin();
  const { data, error } = await admin.rpc(
    "refresh_spotify_chart_backfill_campaign_progress",
    { p_phase_key: phaseKey?.trim().toLowerCase() || null },
  );

  if (error) {
    throw new Error(`Nao foi possivel atualizar o progresso: ${error.message}`);
  }

  return (data ?? []) as SpotifyChartBackfillCampaign[];
}

export async function startSpotifyChartBackfillCampaign(phaseKey: string) {
  const campaigns = await getSpotifyChartBackfillCampaigns();
  const targetCampaign = campaigns.find(
    (campaign) => campaign.phase_key === phaseKey.trim().toLowerCase(),
  );
  const anchorEndDate = getSpotifyChartBackfillRolloutAnchorEndDate(campaigns);
  const plan = planSpotifyChartBackfillPhase(
    phaseKey,
    new Date(),
    anchorEndDate,
  );

  if (!plan) {
    throw new Error("Fase de backfill desconhecida.");
  }

  if (!plan.sourceReady) {
    return {
      started: false as const,
      reason: "historical_sources_not_ready" as const,
      plan,
      campaign: null,
    };
  }

  if (
    targetCampaign &&
    (targetCampaign.status === "running" ||
      targetCampaign.status === "completed")
  ) {
    return {
      started: true as const,
      reason: null,
      plan,
      campaign: targetCampaign,
    };
  }

  const admin = requireCampaignAdmin();
  const isCityPhase = plan.regionIds.some(
    (regionId) => regionId !== "BR" && regionId !== "GLOBAL",
  );
  const { data, error } = await admin
    .rpc("start_spotify_chart_backfill_campaign", {
      p_phase_key: plan.phaseKey,
      p_end_date: plan.endDate,
      p_enable_regions: isCityPhase,
    })
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Nao foi possivel iniciar a fase: ${error?.message ?? "campanha ausente"}`,
    );
  }

  return {
    started: true as const,
    reason: null,
    plan,
    campaign: data as SpotifyChartBackfillCampaign,
  };
}

export async function approveSpotifyChartBackfillCampaign(phaseKey: string) {
  const admin = requireCampaignAdmin();
  const { data, error } = await admin
    .rpc("approve_spotify_chart_backfill_campaign", {
      p_phase_key: phaseKey.trim().toLowerCase(),
    })
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Nao foi possivel aprovar a fase: ${error?.message ?? "campanha ausente"}`,
    );
  }

  return data as SpotifyChartBackfillCampaign;
}

export async function setSpotifyChartBackfillCampaignPaused(
  phaseKey: string,
  paused: boolean,
) {
  const admin = requireCampaignAdmin();
  const { data, error } = await admin
    .rpc("set_spotify_chart_backfill_campaign_paused", {
      p_phase_key: phaseKey.trim().toLowerCase(),
      p_paused: paused,
    })
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Nao foi possivel ${paused ? "pausar" : "retomar"} a fase: ${error?.message ?? "campanha ausente"}`,
    );
  }

  return data as SpotifyChartBackfillCampaign;
}
