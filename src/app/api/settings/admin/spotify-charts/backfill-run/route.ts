import { NextResponse } from "next/server";
import { authorizeSpotifyChartsAdminRequest } from "@/lib/charts/spotify-chart-admin-auth";
import {
  getSpotifyChartBackfillCampaigns,
  getSpotifyChartBackfillPhaseDefinition,
  isCoreSpotifyChartBackfillPhase,
  refreshSpotifyChartBackfillCampaignProgress,
} from "@/lib/charts/spotify-chart-backfill-campaigns";
import { peekNextSpotifyChartBackfillJobs } from "@/lib/charts/spotify-chart-backfill-jobs";
import { processSpotifyChartBackfillQueue } from "@/lib/charts/spotify-chart-backfill-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMIT = 3;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function parseRequestPhase(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort();

  if (
    keys.length !== 2 ||
    keys[0] !== "limit" ||
    keys[1] !== "phase" ||
    body.limit !== LIMIT ||
    typeof body.phase !== "string"
  ) {
    return null;
  }

  const phase = getSpotifyChartBackfillPhaseDefinition(body.phase);
  return phase && isCoreSpotifyChartBackfillPhase(phase) ? phase : null;
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

  const phase = parseRequestPhase(requestBody);

  if (!phase) {
    return json(
      {
        success: false,
        requestId,
        error: "Only cataloged core batches with limit 3 are allowed.",
      },
      400,
    );
  }

  try {
    await refreshSpotifyChartBackfillCampaignProgress();
    const before = await getSpotifyChartBackfillCampaigns();
    const core = before.find((campaign) => campaign.phase_key === phase.key);
    const concurrent = before.filter(
      (campaign) =>
        campaign.phase_key !== phase.key && campaign.status === "running",
    );

    if (!core || core.status !== "running" || concurrent.length > 0) {
      return json(
        {
          success: false,
          requestId,
          error: "campaign_guard_failed",
          coreStatus: core?.status ?? null,
          concurrentPhases: concurrent.map((campaign) => campaign.phase_key),
        },
        409,
      );
    }

    const candidates = await peekNextSpotifyChartBackfillJobs({
      limit: LIMIT,
      phaseKey: phase.key,
    });
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

    if (
      candidates.length < 1 ||
      candidates.length > LIMIT ||
      invalidCandidates.length > 0
    ) {
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

    const worker = await processSpotifyChartBackfillQueue({
      limit: candidates.length,
      phaseKey: phase.key,
    });
    const campaigns = await refreshSpotifyChartBackfillCampaignProgress();
    const completedBatch =
      worker.processed === candidates.length &&
      worker.sourceValidated === candidates.length &&
      !worker.sourceBlocked &&
      worker.failed === 0 &&
      worker.retryPending === 0 &&
      worker.lostLease === 0 &&
      worker.success + worker.skipped === candidates.length;

    return json(
      {
        success: completedBatch,
        requestId,
        phase: phase.key,
        limit: LIMIT,
        batchSize: candidates.length,
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
