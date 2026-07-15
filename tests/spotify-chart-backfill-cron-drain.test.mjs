import assert from "node:assert/strict";
import test from "node:test";

const {
  drainSpotifyChartBackfillCron,
  isAutomaticSpotifyChartBackfillCronRequest,
} = await import("../src/lib/charts/spotify-chart-backfill-cron.ts");

function round(overrides = {}) {
  return {
    appliedLimit: 3,
    previewed: 3,
    sourceBlocked: false,
    processed: 3,
    failed: 0,
    retryPending: 0,
    lostLease: 0,
    stoppedForTimeBudget: false,
    ...overrides,
  };
}

test("only parameterless Vercel invocations enable automatic draining", () => {
  const scheduleHeaders = { "x-vercel-cron-schedule": "0 11 * * *" };
  const compatibilityHeaders = { "user-agent": "vercel-cron/1.0" };

  assert.equal(
    isAutomaticSpotifyChartBackfillCronRequest(
      new Request("https://example.test/api/cron", {
        headers: scheduleHeaders,
      }),
    ),
    true,
  );
  assert.equal(
    isAutomaticSpotifyChartBackfillCronRequest(
      new Request("https://example.test/api/cron", {
        headers: compatibilityHeaders,
      }),
    ),
    true,
  );
  assert.equal(
    isAutomaticSpotifyChartBackfillCronRequest(
      new Request("https://example.test/api/cron?action=run", {
        headers: scheduleHeaders,
      }),
    ),
    false,
  );
  assert.equal(
    isAutomaticSpotifyChartBackfillCronRequest(
      new Request("https://example.test/api/cron"),
    ),
    false,
  );
});

test("explicit calls run exactly one round even when a larger cap is supplied", async () => {
  let calls = 0;
  const result = await drainSpotifyChartBackfillCron(
    {
      automatic: false,
      limit: 3,
      phaseKey: "core-79d",
      maxRounds: 10,
    },
    async () => {
      calls += 1;
      return round();
    },
  );

  assert.equal(calls, 1);
  assert.equal(result.roundCount, 1);
  assert.equal(result.stopReason, "explicit_single_round");
});

test("automatic drains stop when the queue becomes empty and aggregate work", async () => {
  let calls = 0;
  const result = await drainSpotifyChartBackfillCron(
    {
      automatic: true,
      limit: 3,
      phaseKey: "core-79d",
    },
    async () => {
      calls += 1;
      return calls === 1
        ? round()
        : round({ appliedLimit: 3, previewed: 0, processed: 0 });
    },
  );

  assert.equal(calls, 2);
  assert.equal(result.stopReason, "queue_empty");
  assert.deepEqual(result.totals, {
    previewed: 3,
    processed: 3,
    failed: 0,
    retryPending: 0,
    lostLease: 0,
  });
});

test("automatic drains leave a full round of headroom before 300 seconds", async () => {
  let clock = 0;
  let calls = 0;
  const result = await drainSpotifyChartBackfillCron(
    {
      automatic: true,
      limit: 3,
      phaseKey: "core-79d",
      now: () => clock,
      maxRounds: 10,
      startBudgetMs: 240_000,
    },
    async () => {
      calls += 1;
      clock += 60_000;
      return round();
    },
  );

  assert.equal(calls, 4);
  assert.equal(result.roundCount, 4);
  assert.equal(result.stopReason, "time_budget");
  assert.equal(result.durationMs, 240_000);
});

test("an internally time-limited round stops before claim contention is inferred", async () => {
  let calls = 0;
  const result = await drainSpotifyChartBackfillCron(
    { automatic: true, limit: 10, phaseKey: "core-79d" },
    async () => {
      calls += 1;
      return round({
        appliedLimit: 10,
        previewed: 4,
        processed: 3,
        stoppedForTimeBudget: true,
      });
    },
  );

  assert.equal(calls, 1);
  assert.equal(result.stopReason, "time_budget");
});

test("automatic drains fail closed after a non-clean round", async () => {
  let calls = 0;
  const result = await drainSpotifyChartBackfillCron(
    { automatic: true, limit: 3, phaseKey: "core-79d" },
    async () => {
      calls += 1;
      return round({ processed: 1, retryPending: 1 });
    },
  );

  assert.equal(calls, 1);
  assert.equal(result.stopReason, "retry_pending");
  assert.equal(result.totals.retryPending, 1);
});
