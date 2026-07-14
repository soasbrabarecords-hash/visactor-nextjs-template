import "server-only";
import { backfillSpotifyCharts } from "@/lib/charts/spotify-chart-backfill";
import {
  SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT,
  SPOTIFY_CHART_BACKFILL_MAX_LIMIT,
  type SpotifyChartBackfillJob,
  claimSpotifyChartBackfillJobById,
  peekNextSpotifyChartBackfillJobs,
  recoverExpiredSpotifyChartBackfillJobs,
  settleSpotifyChartBackfillJob,
} from "@/lib/charts/spotify-chart-backfill-jobs";
import type {
  AutomaticChart,
  DownloadedSpotifyChart,
} from "@/lib/charts/spotify-chart-source";
import { probeSpotifyChartHistoricalSource } from "@/lib/charts/spotify-chart-source-test";
import { createAdminClient } from "@/lib/supabase/admin";

const WORKER_LEASE_SECONDS = 300;
const WORKER_START_BUDGET_MS = 20_000;
const EXPECTED_TOP_200_TRACKS = 200;

export type SpotifyChartBackfillWorkerResult = {
  jobId: string;
  regionId: string;
  targetDate: string;
  status: "success" | "failed" | "retry-pending" | "skipped" | "lost-lease";
  rowsCount: number;
  error?: string;
};

function normalizeWorkerLimit(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT;
  }

  return Math.min(
    Math.max(Math.trunc(value ?? SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT), 1),
    SPOTIFY_CHART_BACKFILL_MAX_LIMIT,
  );
}

function normalizeError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Erro desconhecido no backfill.";
  return message.slice(0, 4000);
}

async function readSnapshotIntegrity(job: SpotifyChartBackfillJob) {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to verify chart snapshots.",
    );
  }

  const { data: snapshot, error: snapshotError } = await admin
    .from("chart_snapshots")
    .select("id,total_tracks")
    .eq("country", job.region_id)
    .eq("chart_type", job.chart_type)
    .eq("chart_date", job.target_date)
    .maybeSingle();

  if (snapshotError) {
    throw new Error(
      `Nao foi possivel verificar o calendario: ${snapshotError.message}`,
    );
  }

  if (!snapshot) return null;

  const { data: tracks, error: tracksError } = await admin
    .from("chart_snapshot_tracks")
    .select("position,spotify_track_id")
    .eq("snapshot_id", snapshot.id)
    .order("position", { ascending: true })
    .limit(EXPECTED_TOP_200_TRACKS + 1);

  if (tracksError) {
    throw new Error(
      `Nao foi possivel contar as faixas do snapshot: ${tracksError.message}`,
    );
  }

  const rows = tracks ?? [];
  const positions = rows.map((track) => Number(track.position));
  const uniquePositions = new Set(positions);
  const trackIds = rows
    .map((track) => track.spotify_track_id?.trim() ?? "")
    .filter(Boolean);
  const uniqueTrackIds = new Set(trackIds);
  const hasContinuousPositions = Array.from(
    { length: EXPECTED_TOP_200_TRACKS },
    (_value, index) => index + 1,
  ).every((position) => uniquePositions.has(position));

  return {
    snapshotId: snapshot.id as string,
    totalTracks: snapshot.total_tracks as number,
    tracksCount: rows.length,
    uniquePositions: uniquePositions.size,
    uniqueTrackIds: uniqueTrackIds.size,
    completeTop200:
      snapshot.total_tracks === EXPECTED_TOP_200_TRACKS &&
      rows.length === EXPECTED_TOP_200_TRACKS &&
      uniquePositions.size === EXPECTED_TOP_200_TRACKS &&
      uniqueTrackIds.size === EXPECTED_TOP_200_TRACKS &&
      trackIds.length === EXPECTED_TOP_200_TRACKS &&
      hasContinuousPositions,
  };
}

async function verifyImportedSnapshot(
  job: SpotifyChartBackfillJob,
  expectedRowsCount: number,
) {
  const snapshot = await readSnapshotIntegrity(job);

  if (
    expectedRowsCount !== EXPECTED_TOP_200_TRACKS ||
    !snapshot?.completeTop200 ||
    snapshot.tracksCount !== expectedRowsCount
  ) {
    throw new Error(
      `Snapshot incompleto: esperado=${expectedRowsCount}, cabecalho=${snapshot?.totalTracks ?? 0}, faixas=${snapshot?.tracksCount ?? 0}, posicoes=${snapshot?.uniquePositions ?? 0}, track_ids=${snapshot?.uniqueTrackIds ?? 0}.`,
    );
  }

  return snapshot;
}

async function settleClaimedJob(
  job: SpotifyChartBackfillJob,
  input: {
    outcome: "success" | "failed" | "skipped";
    error?: string;
  },
) {
  if (!job.lease_token) {
    throw new Error(`Job ${job.id} foi reservado sem lease token.`);
  }

  return settleSpotifyChartBackfillJob({
    jobId: job.id,
    leaseToken: job.lease_token,
    outcome: input.outcome,
    error: input.error,
  });
}

async function processClaimedJob(
  job: SpotifyChartBackfillJob,
  chart: AutomaticChart,
  downloaded: DownloadedSpotifyChart,
): Promise<SpotifyChartBackfillWorkerResult> {
  const baseResult = {
    jobId: job.id,
    regionId: job.region_id,
    targetDate: job.target_date,
  };

  try {
    if (job.period !== "daily" || job.chart_type !== "top-songs") {
      const reason = `Configuracao ainda nao suportada: ${job.chart_type}/${job.period}.`;
      const settled = await settleClaimedJob(job, {
        outcome: "skipped",
        error: reason,
      });

      return {
        ...baseResult,
        status: settled ? "skipped" : "lost-lease",
        rowsCount: 0,
        error: reason,
      };
    }

    const existingSnapshot = await readSnapshotIntegrity(job);

    if (existingSnapshot?.completeTop200) {
      const reason = "Snapshot ja esta completo no calendario.";
      const settled = await settleClaimedJob(job, {
        outcome: "skipped",
        error: reason,
      });

      return {
        ...baseResult,
        status: settled ? "skipped" : "lost-lease",
        rowsCount: existingSnapshot.tracksCount,
        error: reason,
      };
    }

    const summary = await backfillSpotifyCharts(
      {
        country: job.region_id,
        chartType: job.chart_type,
        startDate: job.target_date,
        endDate: job.target_date,
      },
      { chart, download: async () => downloaded },
    );
    const result = summary.results[0];

    if (!result?.success) {
      throw new Error(
        result?.error ?? `A importacao de ${job.target_date} falhou.`,
      );
    }

    await verifyImportedSnapshot(job, result.rowsCount);
    const settled = await settleClaimedJob(job, { outcome: "success" });

    return {
      ...baseResult,
      status: settled ? "success" : "lost-lease",
      rowsCount: result.rowsCount,
      ...(!settled ? { error: "Lease expirou antes da confirmacao." } : {}),
    };
  } catch (error) {
    const message = normalizeError(error);

    try {
      const settled = await settleClaimedJob(job, {
        outcome: "failed",
        error: message,
      });

      return {
        ...baseResult,
        status: settled
          ? settled.status === "pending"
            ? "retry-pending"
            : "failed"
          : "lost-lease",
        rowsCount: 0,
        error: message,
      };
    } catch (settleError) {
      return {
        ...baseResult,
        status: "lost-lease",
        rowsCount: 0,
        error: `${message} | ${normalizeError(settleError)}`,
      };
    }
  }
}

export async function processSpotifyChartBackfillQueue(
  input: {
    limit?: number;
  } = {},
) {
  const startedAt = Date.now();
  const limit = normalizeWorkerLimit(input.limit);
  const workerId = `spotify-backfill:${crypto.randomUUID()}`;
  const recovered = await recoverExpiredSpotifyChartBackfillJobs(10);
  const results: SpotifyChartBackfillWorkerResult[] = [];
  const sourceErrors: Array<{
    jobId: string;
    regionId: string;
    targetDate: string;
    error: string;
  }> = [];
  const candidates = await peekNextSpotifyChartBackfillJobs({ limit });
  const prepared: Array<{
    candidate: SpotifyChartBackfillJob;
    chart: AutomaticChart;
    downloaded: DownloadedSpotifyChart;
  }> = [];

  for (const candidate of candidates) {
    if (
      prepared.length > 0 &&
      Date.now() - startedAt >= WORKER_START_BUDGET_MS
    ) {
      break;
    }

    try {
      const probe = await probeSpotifyChartHistoricalSource({
        regionId: candidate.region_id,
        chartType: candidate.chart_type,
        date: candidate.target_date,
      });
      prepared.push({
        candidate,
        chart: probe.chart,
        downloaded: probe.downloaded,
      });
    } catch (error) {
      sourceErrors.push({
        jobId: candidate.id,
        regionId: candidate.region_id,
        targetDate: candidate.target_date,
        error: normalizeError(error),
      });
      break;
    }
  }

  // The batch is all-or-nothing at preflight time. A failure in the second or
  // third candidate cannot consume a previously validated job.
  if (sourceErrors.length === 0) {
    for (const item of prepared) {
      const job = await claimSpotifyChartBackfillJobById({
        jobId: item.candidate.id,
        workerId,
        leaseSeconds: WORKER_LEASE_SECONDS,
      });

      if (!job) {
        continue;
      }

      results.push(await processClaimedJob(job, item.chart, item.downloaded));
    }
  }

  return {
    workerId,
    requestedLimit: input.limit ?? SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT,
    appliedLimit: limit,
    recovered,
    previewed: candidates.length,
    sourceValidated: prepared.length,
    sourceBlocked: sourceErrors.length > 0,
    sourceErrors,
    processed: results.length,
    success: results.filter((result) => result.status === "success").length,
    failed: results.filter((result) => result.status === "failed").length,
    retryPending: results.filter((result) => result.status === "retry-pending")
      .length,
    skipped: results.filter((result) => result.status === "skipped").length,
    lostLease: results.filter((result) => result.status === "lost-lease")
      .length,
    stoppedForTimeBudget:
      results.length < limit &&
      Date.now() - startedAt >= WORKER_START_BUDGET_MS,
    durationMs: Date.now() - startedAt,
    results,
  };
}
