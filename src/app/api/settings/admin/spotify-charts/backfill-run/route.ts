import { NextResponse } from "next/server";
import { authorizeSpotifyChartsAdminRequest } from "@/lib/charts/spotify-chart-admin-auth";
import {
  getSpotifyChartBackfillCampaigns,
  refreshSpotifyChartBackfillCampaignProgress,
} from "@/lib/charts/spotify-chart-backfill-campaigns";
import { peekNextSpotifyChartBackfillJobs } from "@/lib/charts/spotify-chart-backfill-jobs";
import { processSpotifyChartBackfillQueue } from "@/lib/charts/spotify-chart-backfill-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PHASE = "core-30d";
const LIMIT = 3;
const LOCKED_PHASES = [
  "core-180d",
  "core-365d",
  "cities-30d",
  "cities-180d",
] as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function isExactRequestBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort();

  return (
    keys.length === 2 &&
    keys[0] === "limit" &&
    keys[1] === "phase" &&
    body.phase === PHASE &&
    body.limit === LIMIT
  );
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const authorization = await authorizeSpotifyChartsAdminRequest(request);

  if (!authorization.authorized) {
    return json(
      { success: false, requestId, error: authorization.error },
      authorization.status,
    );
  }

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return json({ success: false, requestId, error: "invalid_request" }, 400);
  }

  if (!isExactRequestBody(requestBody)) {
    return json(
      {
        success: false,
        requestId,
        error: "Only core-30d batches of exactly 3 jobs are allowed.",
      },
      400,
    );
  }

  try {
    await refreshSpotifyChartBackfillCampaignProgress();
    const before = await getSpotifyChartBackfillCampaigns();
    const core = before.find((campaign) => campaign.phase_key === PHASE);
    const unlocked = before.filter(
      (campaign) =>
        LOCKED_PHASES.includes(
          campaign.phase_key as (typeof LOCKED_PHASES)[number],
        ) && campaign.status !== "locked",
    );

    if (!core || core.status !== "running" || unlocked.length > 0) {
      return json(
        {
          success: false,
          requestId,
          error: "campaign_guard_failed",
          coreStatus: core?.status ?? null,
          unlockedPhases: unlocked.map((campaign) => campaign.phase_key),
        },
        409,
      );
    }

    const candidates = await peekNextSpotifyChartBackfillJobs({ limit: LIMIT });
    const invalidCandidates = candidates.filter(
      (job) =>
        !["BR", "GLOBAL"].includes(job.region_id) ||
        job.chart_type !== "top-songs" ||
        job.period !== "daily" ||
        !core.target_start_date ||
        !core.target_end_date ||
        job.target_date < core.target_start_date ||
        job.target_date > core.target_end_date,
    );

    if (candidates.length !== LIMIT || invalidCandidates.length > 0) {
      return json(
        {
          success: false,
          requestId,
          error: "candidate_guard_failed",
          candidateCount: candidates.length,
          invalidJobIds: invalidCandidates.map((job) => job.id),
        },
        409,
      );
    }

    const worker = await processSpotifyChartBackfillQueue({ limit: LIMIT });
    const campaigns = await refreshSpotifyChartBackfillCampaignProgress();
    const completedBatch =
      worker.processed === LIMIT &&
      worker.sourceValidated === LIMIT &&
      !worker.sourceBlocked &&
      worker.failed === 0 &&
      worker.retryPending === 0 &&
      worker.lostLease === 0 &&
      worker.success + worker.skipped === LIMIT;

    return json(
      {
        success: completedBatch,
        requestId,
        phase: PHASE,
        limit: LIMIT,
        worker,
        campaigns,
      },
      completedBatch ? 200 : 502,
    );
  } catch (error) {
    return json(
      {
        success: false,
        requestId,
        error:
          error instanceof Error ? error.message : "Backfill batch failed.",
      },
      500,
    );
  }
}
