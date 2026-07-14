import { NextResponse } from "next/server";
import {
  approveSpotifyChartBackfillCampaign,
  getSpotifyChartBackfillCampaigns,
  planSpotifyChartBackfillPhase,
  refreshSpotifyChartBackfillCampaignProgress,
  setSpotifyChartBackfillCampaignPaused,
  startSpotifyChartBackfillCampaign,
} from "@/lib/charts/spotify-chart-backfill-campaigns";
import {
  SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT,
  SPOTIFY_CHART_BACKFILL_MAX_LIMIT,
  SPOTIFY_CHART_BACKFILL_SUPPORTED_DAYS,
  type SpotifyChartBackfillSeedDays,
  enqueueRecentSpotifyChartBackfillJobs,
  planRecentSpotifyChartBackfillJobs,
} from "@/lib/charts/spotify-chart-backfill-jobs";
import { processSpotifyChartBackfillQueue } from "@/lib/charts/spotify-chart-backfill-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BACKFILL_ACTIONS = [
  "run",
  "start",
  "status",
  "approve",
  "pause",
  "resume",
] as const;

type BackfillAction = (typeof BACKFILL_ACTIONS)[number];

function parseLimit(value: string | null) {
  if (value === null) return SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT;
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return parsed >= 1 && parsed <= SPOTIFY_CHART_BACKFILL_MAX_LIMIT
    ? parsed
    : null;
}

function parseDays(value: string | null): SpotifyChartBackfillSeedDays | null {
  if (value === null) return null;

  const parsed = Number(value);
  return SPOTIFY_CHART_BACKFILL_SUPPORTED_DAYS.includes(
    parsed as SpotifyChartBackfillSeedDays,
  )
    ? (parsed as SpotifyChartBackfillSeedDays)
    : null;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const limit = parseLimit(searchParams.get("limit"));
  const rawDays = searchParams.get("days");
  const days = parseDays(rawDays);
  const rawDryRun = searchParams.get("dry_run");
  const dryRun = rawDryRun === "1";
  const rawPhase = searchParams.get("phase");
  const phasePlan = rawPhase ? planSpotifyChartBackfillPhase(rawPhase) : null;
  const rawAction = searchParams.get("action") ?? "run";
  const action = BACKFILL_ACTIONS.includes(rawAction as BackfillAction)
    ? (rawAction as BackfillAction)
    : null;

  if (limit === null) {
    return NextResponse.json(
      { success: false, error: "limit deve estar entre 1 e 10." },
      { status: 400 },
    );
  }

  if (rawDays !== null && days === null) {
    return NextResponse.json(
      { success: false, error: "days deve ser 7 ou 30." },
      { status: 400 },
    );
  }

  if (rawDryRun !== null && rawDryRun !== "1") {
    return NextResponse.json(
      { success: false, error: "dry_run aceita somente o valor 1." },
      { status: 400 },
    );
  }

  if (!action) {
    return NextResponse.json(
      {
        success: false,
        error: "action deve ser run, start, status, approve, pause ou resume.",
      },
      { status: 400 },
    );
  }

  if (rawPhase && !phasePlan) {
    return NextResponse.json(
      { success: false, error: "Fase de backfill desconhecida." },
      { status: 400 },
    );
  }

  if (rawPhase && rawDays !== null) {
    return NextResponse.json(
      { success: false, error: "Use phase ou days, nunca os dois juntos." },
      { status: 400 },
    );
  }

  if (["start", "approve", "pause", "resume"].includes(action) && !phasePlan) {
    return NextResponse.json(
      { success: false, error: `action=${action} exige uma phase valida.` },
      { status: 400 },
    );
  }

  if (dryRun) {
    const seed = days ? planRecentSpotifyChartBackfillJobs(days) : null;

    return NextResponse.json({
      success: true,
      dryRun: true,
      action,
      limit,
      seedComplete:
        (!seed || seed.unavailableRegions.length === 0) &&
        (!phasePlan || phasePlan.sourceReady),
      seed,
      phase: phasePlan,
    });
  }

  try {
    if (action === "status") {
      await refreshSpotifyChartBackfillCampaignProgress(phasePlan?.phaseKey);
      const campaigns = await getSpotifyChartBackfillCampaigns();
      return NextResponse.json({ success: true, campaigns });
    }

    if (action === "approve" && phasePlan) {
      const campaign = await approveSpotifyChartBackfillCampaign(
        phasePlan.phaseKey,
      );
      return NextResponse.json({ success: true, campaign });
    }

    if ((action === "pause" || action === "resume") && phasePlan) {
      const campaign = await setSpotifyChartBackfillCampaignPaused(
        phasePlan.phaseKey,
        action === "pause",
      );
      return NextResponse.json({ success: true, campaign });
    }

    const campaign = phasePlan
      ? await startSpotifyChartBackfillCampaign(phasePlan.phaseKey)
      : null;

    if (campaign && !campaign.started) {
      return NextResponse.json(
        {
          success: false,
          error: campaign.reason,
          phase: campaign.plan,
        },
        { status: 409 },
      );
    }

    const seed = days
      ? await enqueueRecentSpotifyChartBackfillJobs(days)
      : null;
    await refreshSpotifyChartBackfillCampaignProgress();
    const worker = await processSpotifyChartBackfillQueue({ limit });
    const campaigns = await refreshSpotifyChartBackfillCampaignProgress();
    const seedComplete = !seed || seed.unavailableRegions.length === 0;

    return NextResponse.json({
      success:
        seedComplete &&
        !worker.sourceBlocked &&
        worker.failed === 0 &&
        worker.retryPending === 0 &&
        worker.lostLease === 0,
      seedComplete,
      seed,
      campaign,
      campaigns,
      worker,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Falha interna no worker.",
      },
      { status: 500 },
    );
  }
}
