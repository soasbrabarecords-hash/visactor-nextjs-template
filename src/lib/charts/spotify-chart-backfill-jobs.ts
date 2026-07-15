import "server-only";
import type { SpotifyChartBackfillPhaseKey } from "@/lib/charts/spotify-chart-backfill-campaigns";
import {
  getCurrentAutomaticSpotifyChartRegionKeys,
  normalizeSpotifyChartRegionKey,
} from "@/lib/charts/spotify-chart-region-catalog";
import { getHistoricalSpotifyChartSourceReadiness } from "@/lib/charts/spotify-chart-source";
import { createAdminClient } from "@/lib/supabase/admin";

export type SpotifyChartBackfillJobStatus =
  "pending" | "running" | "success" | "failed" | "skipped";

export type SpotifyChartBackfillJob = {
  id: string;
  region_id: string;
  chart_type: string;
  period: string;
  target_date: string;
  status: SpotifyChartBackfillJobStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  worker_id: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

const JOB_COLUMNS =
  "id,region_id,chart_type,period,target_date,status,attempts,max_attempts,next_attempt_at,last_error,worker_id,lease_token,lease_expires_at,started_at,finished_at,created_at,updated_at";

export const SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT = 3;
export const SPOTIFY_CHART_BACKFILL_MAX_LIMIT = 10;
export const SPOTIFY_CHART_BACKFILL_SUPPORTED_DAYS = [7, 30] as const;

export type SpotifyChartBackfillSeedDays =
  (typeof SPOTIFY_CHART_BACKFILL_SUPPORTED_DAYS)[number];

function requireBackfillAdmin() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for Spotify Charts backfill jobs.",
    );
  }

  return admin;
}

function asSpotifyChartBackfillJob(
  value: unknown,
): SpotifyChartBackfillJob | null {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as { id?: unknown }).id !== "string"
  ) {
    return null;
  }

  return value as SpotifyChartBackfillJob;
}

function normalizeSlug(
  value: string,
  field: "chart_type" | "period" | "phase_key",
) {
  const normalized = value.trim().toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(`${field} deve ser uma chave simples em kebab-case.`);
  }

  return normalized;
}

function normalizeTargetDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("target_date deve usar o formato YYYY-MM-DD.");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("target_date deve ser uma data valida.");
  }

  return value;
}

function normalizeOptionalPhaseKey(
  value: SpotifyChartBackfillPhaseKey | undefined,
) {
  if (!value) return null;

  return normalizeSlug(value, "phase_key");
}

export async function enqueueSpotifyChartBackfillJob(input: {
  regionId: string;
  chartType: string;
  period: string;
  targetDate: string;
}) {
  const admin = requireBackfillAdmin();
  const identity = {
    region_id: normalizeSpotifyChartRegionKey(input.regionId),
    chart_type: normalizeSlug(input.chartType, "chart_type"),
    period: normalizeSlug(input.period, "period"),
    target_date: normalizeTargetDate(input.targetDate),
  };

  const { data, error } = await admin
    .from("spotify_chart_backfill_jobs")
    .upsert(identity, {
      ignoreDuplicates: true,
      onConflict: "region_id,chart_type,period,target_date",
    })
    .select(JOB_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Nao foi possivel enfileirar backfill: ${error.message}`);
  }

  if (data) {
    return data as SpotifyChartBackfillJob;
  }

  const existing = await admin
    .from("spotify_chart_backfill_jobs")
    .select(JOB_COLUMNS)
    .eq("region_id", identity.region_id)
    .eq("chart_type", identity.chart_type)
    .eq("period", identity.period)
    .eq("target_date", identity.target_date)
    .maybeSingle();

  if (existing.error || !existing.data) {
    throw new Error(
      `Nao foi possivel localizar o job idempotente: ${existing.error?.message ?? "job ausente"}`,
    );
  }

  return existing.data as SpotifyChartBackfillJob;
}

export async function retrySpotifyChartBackfillJob(jobId: string) {
  const admin = requireBackfillAdmin();
  const { data, error } = await admin
    .from("spotify_chart_backfill_jobs")
    .update({
      status: "pending",
      next_attempt_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .in("status", ["failed", "skipped"])
    .select(JOB_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Nao foi possivel reagendar o backfill: ${error.message}`);
  }

  return asSpotifyChartBackfillJob(data);
}

export async function claimNextSpotifyChartBackfillJob(input: {
  workerId: string;
  leaseSeconds?: number;
}) {
  const admin = requireBackfillAdmin();
  const { data, error } = await admin
    .rpc("claim_spotify_chart_backfill_job", {
      p_worker_id: input.workerId,
      p_lease_seconds: input.leaseSeconds ?? 300,
    })
    .maybeSingle();

  if (error) {
    throw new Error(`Nao foi possivel reservar o backfill: ${error.message}`);
  }

  return asSpotifyChartBackfillJob(data);
}

export async function peekNextSpotifyChartBackfillJobs(input: {
  limit?: number;
  phaseKey?: SpotifyChartBackfillPhaseKey;
}) {
  const admin = requireBackfillAdmin();
  const limit = Math.min(
    Math.max(
      Math.trunc(input.limit ?? SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT),
      1,
    ),
    SPOTIFY_CHART_BACKFILL_MAX_LIMIT,
  );
  const { data, error } = await admin.rpc("peek_spotify_chart_backfill_jobs", {
    p_limit: limit,
    p_phase_key: normalizeOptionalPhaseKey(input.phaseKey),
  });

  if (error) {
    throw new Error(
      `Nao foi possivel visualizar a fila antes do preflight: ${error.message}`,
    );
  }

  return (Array.isArray(data) ? data : [])
    .map(asSpotifyChartBackfillJob)
    .filter((job): job is SpotifyChartBackfillJob => Boolean(job));
}

export async function claimSpotifyChartBackfillJobById(input: {
  jobId: string;
  workerId: string;
  leaseSeconds?: number;
  phaseKey?: SpotifyChartBackfillPhaseKey;
}) {
  const admin = requireBackfillAdmin();
  const { data, error } = await admin
    .rpc("claim_spotify_chart_backfill_job_by_id", {
      p_job_id: input.jobId,
      p_worker_id: input.workerId,
      p_lease_seconds: input.leaseSeconds ?? 300,
      p_phase_key: normalizeOptionalPhaseKey(input.phaseKey),
    })
    .maybeSingle();

  if (error) {
    throw new Error(
      `Nao foi possivel reservar o backfill validado: ${error.message}`,
    );
  }

  return asSpotifyChartBackfillJob(data);
}

export async function settleSpotifyChartBackfillJob(input: {
  jobId: string;
  leaseToken: string;
  outcome: Extract<
    SpotifyChartBackfillJobStatus,
    "success" | "failed" | "skipped"
  >;
  error?: string | null;
}) {
  const admin = requireBackfillAdmin();
  const { data, error } = await admin
    .rpc("settle_spotify_chart_backfill_job", {
      p_job_id: input.jobId,
      p_lease_token: input.leaseToken,
      p_outcome: input.outcome,
      p_error: input.error ?? null,
    })
    .maybeSingle();

  if (error) {
    throw new Error(`Nao foi possivel finalizar o backfill: ${error.message}`);
  }

  return asSpotifyChartBackfillJob(data);
}

export async function recoverExpiredSpotifyChartBackfillJobs(limit = 10) {
  const admin = requireBackfillAdmin();
  const { data, error } = await admin.rpc(
    "recover_spotify_chart_backfill_jobs",
    { p_limit: Math.min(Math.max(Math.trunc(limit), 1), 10) },
  );

  if (error) {
    throw new Error(
      `Nao foi possivel recuperar leases expirados: ${error.message}`,
    );
  }

  return typeof data === "number" ? data : Number(data ?? 0);
}

export async function reconcileSpotifyChartBackfillCoveredJobs(input: {
  phaseKey: SpotifyChartBackfillPhaseKey;
  limit?: number;
}) {
  const admin = requireBackfillAdmin();
  const requestedLimit = Number.isFinite(input.limit) ? input.limit : 100;
  const limit = Math.min(Math.max(Math.trunc(requestedLimit ?? 100), 1), 500);
  const { data, error } = await admin.rpc(
    "reconcile_spotify_chart_backfill_covered_jobs",
    {
      p_phase_key: normalizeOptionalPhaseKey(input.phaseKey),
      p_limit: limit,
    },
  );

  if (error) {
    throw new Error(
      `Nao foi possivel reconciliar jobs ja cobertos: ${error.message}`,
    );
  }

  return typeof data === "number" ? data : Number(data ?? 0);
}

export function getRecentSpotifyChartBackfillDates(
  days: SpotifyChartBackfillSeedDays,
  now = new Date(),
) {
  if (!SPOTIFY_CHART_BACKFILL_SUPPORTED_DAYS.includes(days)) {
    throw new Error("days deve ser 7 ou 30.");
  }

  const latestCompletedDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  latestCompletedDay.setUTCDate(latestCompletedDay.getUTCDate() - 1);

  return Array.from({ length: days }, (_value, index) => {
    const date = new Date(latestCompletedDay);
    date.setUTCDate(latestCompletedDay.getUTCDate() - index);
    return date.toISOString().slice(0, 10);
  });
}

export function planRecentSpotifyChartBackfillJobs(
  days: SpotifyChartBackfillSeedDays,
  now = new Date(),
) {
  const dates = getRecentSpotifyChartBackfillDates(days, now);
  const sourceReadiness = getHistoricalSpotifyChartSourceReadiness(
    getCurrentAutomaticSpotifyChartRegionKeys(),
  );
  const regionIds = sourceReadiness
    .filter((source) => source.supportsHistoricalDates)
    .map((source) => source.regionId);
  const unavailableRegions = sourceReadiness.filter(
    (source) => !source.supportsHistoricalDates,
  );

  return {
    days,
    regionIds,
    unavailableRegions,
    dates,
    jobs: regionIds.flatMap((regionId) =>
      dates.map((targetDate) => ({
        region_id: regionId,
        chart_type: "top-songs",
        period: "daily",
        target_date: targetDate,
      })),
    ),
  };
}

export async function enqueueRecentSpotifyChartBackfillJobs(
  days: SpotifyChartBackfillSeedDays,
) {
  const plan = planRecentSpotifyChartBackfillJobs(days);

  if (plan.jobs.length === 0) {
    return {
      days: plan.days,
      regions: [...plan.regionIds],
      unavailableRegions: plan.unavailableRegions,
      dates: plan.dates,
      requested: 0,
      inserted: 0,
      existing: 0,
    };
  }

  const admin = requireBackfillAdmin();
  const { data, error } = await admin
    .from("spotify_chart_backfill_jobs")
    .upsert(plan.jobs, {
      ignoreDuplicates: true,
      onConflict: "region_id,chart_type,period,target_date",
    })
    .select("id");

  if (error) {
    throw new Error(
      `Nao foi possivel preparar a janela de backfill: ${error.message}`,
    );
  }

  return {
    days: plan.days,
    regions: [...plan.regionIds],
    unavailableRegions: plan.unavailableRegions,
    dates: plan.dates,
    requested: plan.jobs.length,
    inserted: data?.length ?? 0,
    existing: plan.jobs.length - (data?.length ?? 0),
  };
}

export async function setSpotifyChartRegionBackfillPaused(
  regionId: string,
  paused: boolean,
) {
  const admin = requireBackfillAdmin();
  const regionKey = normalizeSpotifyChartRegionKey(regionId);

  if (!paused) {
    const { data, error } = await admin
      .from("spotify_chart_regions")
      .select("enabled")
      .eq("region_key", regionKey)
      .maybeSingle();

    if (error || !data) {
      throw new Error(
        `Nao foi possivel localizar a regiao: ${error?.message ?? "regiao ausente"}`,
      );
    }

    if (!data.enabled) {
      throw new Error(
        `A regiao ${regionKey} precisa estar habilitada antes de liberar o backfill.`,
      );
    }
  }

  const { data, error } = await admin
    .from("spotify_chart_regions")
    .update({ backfill_enabled: !paused })
    .eq("region_key", regionKey)
    .select("region_key,enabled,backfill_enabled")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Nao foi possivel ${paused ? "pausar" : "retomar"} a regiao: ${error?.message ?? "regiao ausente"}`,
    );
  }

  return data;
}
