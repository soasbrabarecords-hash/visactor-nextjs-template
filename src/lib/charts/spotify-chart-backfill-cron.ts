export const SPOTIFY_CHART_BACKFILL_CRON_MAX_DURATION_SECONDS = 300;
export const SPOTIFY_CHART_BACKFILL_CRON_MAX_ROUNDS = 10;

// A worker round previously lived inside a 60-second route. Stop starting new
// rounds one minute before Vercel's hard limit so the active round and response
// serialization still have room to finish.
export const SPOTIFY_CHART_BACKFILL_CRON_START_BUDGET_MS =
  (SPOTIFY_CHART_BACKFILL_CRON_MAX_DURATION_SECONDS - 60) * 1000;

const VERCEL_CRON_USER_AGENT = "vercel-cron/1.0";

export type SpotifyChartBackfillCronRound = {
  appliedLimit: number;
  previewed: number;
  sourceBlocked: boolean;
  processed: number;
  failed: number;
  retryPending: number;
  lostLease: number;
  stoppedForTimeBudget: boolean;
};

export type SpotifyChartBackfillCronStopReason =
  | "explicit_single_round"
  | "source_blocked"
  | "worker_failed"
  | "retry_pending"
  | "lost_lease"
  | "queue_empty"
  | "claim_contention"
  | "time_budget"
  | "max_rounds";

export function isAutomaticSpotifyChartBackfillCronRequest(request: Request) {
  const cronSchedule =
    request.headers.get("x-vercel-cron-schedule")?.trim() ?? "";
  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  const hasExplicitParameters = new URL(request.url).search.length > 0;

  return (
    !hasExplicitParameters &&
    (cronSchedule.length > 0 || userAgent.includes(VERCEL_CRON_USER_AGENT))
  );
}

export async function drainSpotifyChartBackfillCron<
  PhaseKey extends string,
  Round extends SpotifyChartBackfillCronRound,
>(
  input: {
    automatic: boolean;
    limit: number;
    phaseKey?: PhaseKey;
    now?: () => number;
    maxRounds?: number;
    startBudgetMs?: number;
  },
  runRound: (input: { limit: number; phaseKey?: PhaseKey }) => Promise<Round>,
) {
  const now = input.now ?? Date.now;
  const startedAt = now();
  const maxRounds = input.automatic
    ? (input.maxRounds ?? SPOTIFY_CHART_BACKFILL_CRON_MAX_ROUNDS)
    : 1;
  const startBudgetMs =
    input.startBudgetMs ?? SPOTIFY_CHART_BACKFILL_CRON_START_BUDGET_MS;
  const rounds: Round[] = [];
  let stopReason: SpotifyChartBackfillCronStopReason = input.automatic
    ? "max_rounds"
    : "explicit_single_round";

  while (rounds.length < maxRounds) {
    if (
      input.automatic &&
      rounds.length > 0 &&
      now() - startedAt >= startBudgetMs
    ) {
      stopReason = "time_budget";
      break;
    }

    const round = await runRound({
      limit: input.limit,
      phaseKey: input.phaseKey,
    });
    rounds.push(round);

    if (!input.automatic) {
      stopReason = "explicit_single_round";
      break;
    }

    if (round.sourceBlocked) {
      stopReason = "source_blocked";
      break;
    }

    if (round.failed > 0) {
      stopReason = "worker_failed";
      break;
    }

    if (round.retryPending > 0) {
      stopReason = "retry_pending";
      break;
    }

    if (round.lostLease > 0) {
      stopReason = "lost_lease";
      break;
    }

    if (round.stoppedForTimeBudget) {
      stopReason = "time_budget";
      break;
    }

    if (round.previewed === 0 || round.processed === 0) {
      stopReason = "queue_empty";
      break;
    }

    if (round.processed < round.previewed) {
      stopReason = "claim_contention";
      break;
    }

    if (round.previewed < round.appliedLimit && !round.stoppedForTimeBudget) {
      stopReason = "queue_empty";
      break;
    }
  }

  return {
    automatic: input.automatic,
    rounds,
    roundCount: rounds.length,
    stopReason,
    durationMs: now() - startedAt,
    totals: {
      previewed: rounds.reduce((total, round) => total + round.previewed, 0),
      processed: rounds.reduce((total, round) => total + round.processed, 0),
      failed: rounds.reduce((total, round) => total + round.failed, 0),
      retryPending: rounds.reduce(
        (total, round) => total + round.retryPending,
        0,
      ),
      lostLease: rounds.reduce((total, round) => total + round.lostLease, 0),
    },
  };
}
