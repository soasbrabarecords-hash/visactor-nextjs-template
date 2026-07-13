import "server-only";
import { backfillSpotifyCharts } from "@/lib/charts/spotify-chart-backfill";
import {
  SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT,
  SPOTIFY_CHART_BACKFILL_MAX_LIMIT,
  type SpotifyChartBackfillJob,
  claimNextSpotifyChartBackfillJob,
  recoverExpiredSpotifyChartBackfillJobs,
  settleSpotifyChartBackfillJob,
} from "@/lib/charts/spotify-chart-backfill-jobs";
import { getBackfillChart } from "@/lib/charts/spotify-chart-source";
import { createAdminClient } from "@/lib/supabase/admin";

const WORKER_LEASE_SECONDS = 300;
const WORKER_START_BUDGET_MS = 20_000;

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

  const { count, error: tracksError } = await admin
    .from("chart_snapshot_tracks")
    .select("id", { count: "exact", head: true })
    .eq("snapshot_id", snapshot.id);

  if (tracksError) {
    throw new Error(
      `Nao foi possivel contar as faixas do snapshot: ${tracksError.message}`,
    );
  }

  return {
    snapshotId: snapshot.id as string,
    totalTracks: snapshot.total_tracks as number,
    tracksCount: count ?? 0,
  };
}

async function verifyImportedSnapshot(
  job: SpotifyChartBackfillJob,
  expectedRowsCount: number,
) {
  const snapshot = await readSnapshotIntegrity(job);

  if (
    !snapshot ||
    snapshot.totalTracks <= 0 ||
    snapshot.tracksCount !== snapshot.totalTracks ||
    snapshot.tracksCount !== expectedRowsCount
  ) {
    throw new Error(
      `Snapshot incompleto: esperado=${expectedRowsCount}, cabecalho=${snapshot?.totalTracks ?? 0}, faixas=${snapshot?.tracksCount ?? 0}.`,
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

    if (!getBackfillChart(job.region_id, job.chart_type)) {
      const reason = `Fonte regional ainda nao configurada para ${job.region_id}.`;
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

    if (
      existingSnapshot &&
      existingSnapshot.totalTracks > 0 &&
      existingSnapshot.tracksCount === existingSnapshot.totalTracks
    ) {
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

    const summary = await backfillSpotifyCharts({
      country: job.region_id,
      chartType: job.chart_type,
      startDate: job.target_date,
      endDate: job.target_date,
    });
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

  for (let index = 0; index < limit; index += 1) {
    if (index > 0 && Date.now() - startedAt >= WORKER_START_BUDGET_MS) {
      break;
    }

    const job = await claimNextSpotifyChartBackfillJob({
      workerId,
      leaseSeconds: WORKER_LEASE_SECONDS,
    });

    if (!job) {
      break;
    }

    results.push(await processClaimedJob(job));
  }

  return {
    workerId,
    requestedLimit: input.limit ?? SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT,
    appliedLimit: limit,
    recovered,
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
