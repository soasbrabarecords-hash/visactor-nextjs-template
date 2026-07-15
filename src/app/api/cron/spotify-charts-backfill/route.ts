import { NextResponse } from "next/server";
import {
  approveSpotifyChartBackfillCampaign,
  getSpotifyChartBackfillCampaigns,
  getSpotifyChartBackfillPhaseDefinition,
  getSpotifyChartBackfillRolloutAnchorEndDate,
  isCoreSpotifyChartBackfillPhase,
  planSpotifyChartBackfillPhase,
  refreshSpotifyChartBackfillCampaignProgress,
  setSpotifyChartBackfillCampaignPaused,
  startSpotifyChartBackfillCampaign,
} from "@/lib/charts/spotify-chart-backfill-campaigns";
import {
  drainSpotifyChartBackfillCron,
  isAutomaticSpotifyChartBackfillCronRequest,
} from "@/lib/charts/spotify-chart-backfill-cron";
import {
  SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT,
  SPOTIFY_CHART_BACKFILL_MAX_LIMIT,
  SPOTIFY_CHART_BACKFILL_SUPPORTED_DAYS,
  type SpotifyChartBackfillSeedDays,
  enqueueRecentSpotifyChartBackfillJobs,
  planRecentSpotifyChartBackfillJobs,
  reconcileSpotifyChartBackfillCoveredJobs,
} from "@/lib/charts/spotify-chart-backfill-jobs";
import { processSpotifyChartBackfillQueue } from "@/lib/charts/spotify-chart-backfill-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const automaticCron = isAutomaticSpotifyChartBackfillCronRequest(request);
  const searchParams = new URL(request.url).searchParams;
  const rawLimit = searchParams.get("limit");
  const parsedLimit = parseLimit(rawLimit);
  const limit =
    automaticCron && rawLimit === null
      ? SPOTIFY_CHART_BACKFILL_MAX_LIMIT
      : parsedLimit;
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

  try {
    if (dryRun) {
      const seed = days ? planRecentSpotifyChartBackfillJobs(days) : null;
      const anchoredPhasePlan = phasePlan
        ? planSpotifyChartBackfillPhase(
            phasePlan.phaseKey,
            new Date(),
            getSpotifyChartBackfillRolloutAnchorEndDate(
              await getSpotifyChartBackfillCampaigns(),
            ),
          )
        : null;

      return NextResponse.json({
        success: true,
        dryRun: true,
        action,
        limit,
        seedComplete:
          (!seed || seed.unavailableRegions.length === 0) &&
          (!anchoredPhasePlan || anchoredPhasePlan.sourceReady),
        seed,
        phase: anchoredPhasePlan,
      });
    }

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

    let selectedPhasePlan = phasePlan;
    let selectedAutomatically = false;
    let selectedReadyCampaign = false;

    if (!selectedPhasePlan && !days && action === "run") {
      await refreshSpotifyChartBackfillCampaignProgress();
      const campaigns = await getSpotifyChartBackfillCampaigns();
      const runningCampaigns = campaigns.filter(
        (candidate) => candidate.status === "running",
      );

      if (runningCampaigns.length > 1) {
        return NextResponse.json(
          {
            success: false,
            error: "Mais de uma campanha esta em execucao.",
            runningPhases: runningCampaigns.map(
              (candidate) => candidate.phase_key,
            ),
          },
          { status: 409 },
        );
      }

      const runningCampaign = runningCampaigns[0] ?? null;
      const readyCampaign = runningCampaign
        ? null
        : (campaigns.find((candidate) => {
            if (candidate.status !== "ready") return false;
            const phase = getSpotifyChartBackfillPhaseDefinition(
              candidate.phase_key,
            );
            return phase ? isCoreSpotifyChartBackfillPhase(phase) : false;
          }) ?? null);
      const selectedCampaign = runningCampaign ?? readyCampaign;

      if (!selectedCampaign) {
        return NextResponse.json({
          success: true,
          idle: true,
          reason: "no_core_phase_running_or_ready",
          campaigns,
        });
      }

      const selectedPhase = getSpotifyChartBackfillPhaseDefinition(
        selectedCampaign.phase_key,
      );

      if (!selectedPhase || !isCoreSpotifyChartBackfillPhase(selectedPhase)) {
        return NextResponse.json(
          {
            success: false,
            error: "A campanha em execucao nao pertence ao rollout core.",
            runningPhase: selectedCampaign.phase_key,
          },
          { status: 409 },
        );
      }

      selectedPhasePlan = planSpotifyChartBackfillPhase(
        selectedPhase.key,
        new Date(),
        getSpotifyChartBackfillRolloutAnchorEndDate(campaigns),
      );

      if (!selectedPhasePlan) {
        return NextResponse.json(
          { success: false, error: "Nao foi possivel planejar a fase core." },
          { status: 500 },
        );
      }

      selectedAutomatically = true;
      selectedReadyCampaign = selectedCampaign.status === "ready";
    }

    const campaign =
      selectedPhasePlan && (!selectedAutomatically || selectedReadyCampaign)
        ? await startSpotifyChartBackfillCampaign(selectedPhasePlan.phaseKey)
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
    const campaignsBeforeDrain =
      await refreshSpotifyChartBackfillCampaignProgress();
    const selectedCampaignBeforeDrain = selectedPhasePlan
      ? campaignsBeforeDrain.find(
          (candidate) => candidate.phase_key === selectedPhasePlan.phaseKey,
        )
      : null;
    const reconciledCoveredJobs =
      selectedPhasePlan && selectedCampaignBeforeDrain?.status === "running"
        ? await reconcileSpotifyChartBackfillCoveredJobs({
            phaseKey: selectedPhasePlan.phaseKey,
            limit: 500,
          })
        : 0;
    const drainResult = await drainSpotifyChartBackfillCron(
      {
        automatic: automaticCron,
        limit,
        phaseKey: selectedPhasePlan?.phaseKey,
      },
      processSpotifyChartBackfillQueue,
    );
    const worker = drainResult.rounds.at(-1);

    if (!worker) {
      throw new Error("O worker nao executou nenhuma rodada.");
    }

    const campaigns = await refreshSpotifyChartBackfillCampaignProgress();
    const seedComplete = !seed || seed.unavailableRegions.length === 0;
    const cleanDrain = drainResult.rounds.every(
      (round) =>
        !round.sourceBlocked &&
        round.failed === 0 &&
        round.retryPending === 0 &&
        round.lostLease === 0,
    );

    return NextResponse.json({
      success: seedComplete && cleanDrain,
      seedComplete,
      seed,
      campaign,
      phase: selectedPhasePlan?.phaseKey ?? null,
      reconciledCoveredJobs,
      campaigns,
      worker,
      drain: {
        automatic: drainResult.automatic,
        roundCount: drainResult.roundCount,
        stopReason: drainResult.stopReason,
        durationMs: drainResult.durationMs,
        totals: drainResult.totals,
      },
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
