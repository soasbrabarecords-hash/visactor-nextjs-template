import assert from "node:assert/strict";
import { mock, test } from "node:test";

let campaigns = [];
let startCalls = [];
let workerCalls = [];
let reconcileCalls = [];
let workerRoundsBeforeEmpty = 1;

const phases = new Map(
  [
    ["core-30d", ["BR", "GLOBAL"]],
    ["core-60d", ["BR", "GLOBAL"]],
    ["core-79d", ["BR", "GLOBAL"]],
    ["core-180d", ["BR", "GLOBAL"]],
    ["cities-30d", ["BR-SP-SAO-PAULO"]],
  ].map(([key, regionIds]) => [key, { key, regionIds }]),
);

function campaign(phaseKey, phaseOrder, status) {
  return {
    rollout_key: "spotify-charts-historical-v1",
    phase_key: phaseKey,
    phase_order: phaseOrder,
    status,
    target_end_date: phaseKey === "core-30d" ? "2026-07-12" : null,
  };
}

mock.module("@/lib/charts/spotify-chart-backfill-campaigns", {
  exports: {
    approveSpotifyChartBackfillCampaign: async () => null,
    getSpotifyChartBackfillCampaigns: async () => campaigns,
    getSpotifyChartBackfillPhaseDefinition: (value) =>
      phases.get(value.trim().toLowerCase()) ?? null,
    getSpotifyChartBackfillRolloutAnchorEndDate: () => "2026-07-12",
    isCoreSpotifyChartBackfillPhase: (phase) =>
      phase.regionIds.every((regionId) => ["BR", "GLOBAL"].includes(regionId)),
    planSpotifyChartBackfillPhase: (phaseKey) => {
      const phase = phases.get(phaseKey);
      return phase ? { phaseKey: phase.key, sourceReady: true } : null;
    },
    refreshSpotifyChartBackfillCampaignProgress: async () => campaigns,
    setSpotifyChartBackfillCampaignPaused: async () => null,
    startSpotifyChartBackfillCampaign: async (phaseKey) => {
      startCalls.push(phaseKey);
      const target =
        campaigns.find((item) => item.phase_key === phaseKey) ?? null;

      if (target?.status === "ready") {
        target.status = "running";
      }

      return {
        started: true,
        reason: null,
        plan: { phaseKey },
        campaign: target,
      };
    },
  },
});

mock.module("@/lib/charts/spotify-chart-backfill-jobs", {
  exports: {
    SPOTIFY_CHART_BACKFILL_DEFAULT_LIMIT: 3,
    SPOTIFY_CHART_BACKFILL_MAX_LIMIT: 10,
    SPOTIFY_CHART_BACKFILL_SUPPORTED_DAYS: [7, 30],
    enqueueRecentSpotifyChartBackfillJobs: async () => null,
    planRecentSpotifyChartBackfillJobs: () => null,
    reconcileSpotifyChartBackfillCoveredJobs: async (input) => {
      reconcileCalls.push(input);
      return input.phaseKey === "core-79d" ? 19 : 0;
    },
  },
});

mock.module("@/lib/charts/spotify-chart-backfill-worker", {
  exports: {
    processSpotifyChartBackfillQueue: async (input) => {
      workerCalls.push(input);
      const hasWork = workerCalls.length <= workerRoundsBeforeEmpty;
      return {
        appliedLimit: input.limit,
        previewed: hasWork ? input.limit : 0,
        processed: hasWork ? input.limit : 0,
        sourceBlocked: false,
        failed: 0,
        retryPending: 0,
        lostLease: 0,
        success: hasWork ? input.limit : 0,
        skipped: 0,
        stoppedForTimeBudget: false,
      };
    },
  },
});

const { GET } =
  await import("../src/app/api/cron/spotify-charts-backfill/route.ts");

function request(query = "") {
  return new Request(
    `http://localhost/api/cron/spotify-charts-backfill${query}`,
    {
      headers: {
        authorization: "Bearer unit-test-secret",
        "x-vercel-cron-schedule": "0 11 * * *",
      },
    },
  );
}

function expectedWorkerCalls(phaseKey, count = 2, limit = 10) {
  return Array.from({ length: count }, () => ({
    limit,
    phaseKey,
  }));
}

test.beforeEach(() => {
  process.env.CRON_SECRET = "unit-test-secret";
  campaigns = [
    campaign("core-30d", 10, "completed"),
    campaign("core-60d", 20, "running"),
    campaign("core-79d", 25, "locked"),
    campaign("core-180d", 30, "locked"),
    campaign("cities-30d", 70, "locked"),
  ];
  startCalls = [];
  workerCalls = [];
  reconcileCalls = [];
  workerRoundsBeforeEmpty = 1;
});

test.after(() => {
  delete process.env.CRON_SECRET;
});

test("scheduled worker scopes itself to the running core phase", async () => {
  const response = await GET(request());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.phase, "core-60d");
  assert.equal(body.drain.automatic, true);
  assert.equal(body.drain.roundCount, 2);
  assert.equal(body.drain.stopReason, "queue_empty");
  assert.equal(body.drain.totals.processed, 10);
  assert.equal(body.worker.appliedLimit, 10);
  assert.deepEqual(startCalls, []);
  assert.deepEqual(reconcileCalls, [{ phaseKey: "core-60d", limit: 500 }]);
  assert.deepEqual(workerCalls, expectedWorkerCalls("core-60d"));
});

test("explicit run requests preserve a single worker round", async () => {
  const response = await GET(request("?action=run"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.phase, "core-60d");
  assert.equal(body.drain.automatic, false);
  assert.equal(body.drain.roundCount, 1);
  assert.equal(body.drain.stopReason, "explicit_single_round");
  assert.equal(body.worker.appliedLimit, 3);
  assert.deepEqual(workerCalls, expectedWorkerCalls("core-60d", 1, 3));
});

test("an explicit completed phase skips covered-job reconciliation", async () => {
  campaigns[1] = campaign("core-60d", 20, "completed");

  const response = await GET(request("?action=run&phase=core-60d"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.phase, "core-60d");
  assert.equal(body.reconciledCoveredJobs, 0);
  assert.deepEqual(reconcileCalls, []);
  assert.deepEqual(workerCalls, expectedWorkerCalls("core-60d", 1, 3));
});

test("scheduled worker starts the first ready core phase", async () => {
  campaigns[1] = campaign("core-60d", 20, "ready");

  const response = await GET(request());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.phase, "core-60d");
  assert.deepEqual(startCalls, ["core-60d"]);
  assert.deepEqual(workerCalls, expectedWorkerCalls("core-60d"));
});

test("scheduled worker starts core-79d immediately after core-60d", async () => {
  campaigns[1] = campaign("core-60d", 20, "completed");
  campaigns[2] = campaign("core-79d", 25, "ready");

  const response = await GET(request());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.phase, "core-79d");
  assert.equal(body.reconciledCoveredJobs, 19);
  assert.deepEqual(startCalls, ["core-79d"]);
  assert.deepEqual(reconcileCalls, [{ phaseKey: "core-79d", limit: 500 }]);
  assert.deepEqual(workerCalls, expectedWorkerCalls("core-79d"));
});

test("running core wins over a later ready phase", async () => {
  campaigns[2] = campaign("core-79d", 25, "ready");

  const response = await GET(request());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.phase, "core-60d");
  assert.deepEqual(startCalls, []);
  assert.deepEqual(workerCalls, expectedWorkerCalls("core-60d"));
});

test("scheduled worker stays idle without a running or ready core", async () => {
  campaigns[1] = campaign("core-60d", 20, "completed");
  campaigns[4] = campaign("cities-30d", 70, "ready");

  const response = await GET(request());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.idle, true);
  assert.equal(body.reason, "no_core_phase_running_or_ready");
  assert.deepEqual(startCalls, []);
  assert.deepEqual(workerCalls, []);
});

test("scheduled worker fails closed for concurrent running phases", async () => {
  campaigns[3] = campaign("core-180d", 30, "running");

  const response = await GET(request());
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.success, false);
  assert.deepEqual(body.runningPhases, ["core-60d", "core-180d"]);
  assert.deepEqual(startCalls, []);
  assert.deepEqual(workerCalls, []);
});

test("scheduled worker never consumes a running city phase", async () => {
  campaigns[1] = campaign("core-60d", 20, "completed");
  campaigns[4] = campaign("cities-30d", 70, "running");

  const response = await GET(request());
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.success, false);
  assert.equal(body.runningPhase, "cities-30d");
  assert.deepEqual(startCalls, []);
  assert.deepEqual(workerCalls, []);
});

test("scheduled worker caps a healthy drain at ten rounds", async () => {
  workerRoundsBeforeEmpty = Number.POSITIVE_INFINITY;

  const response = await GET(request());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.drain.roundCount, 10);
  assert.equal(body.drain.stopReason, "max_rounds");
  assert.equal(body.drain.totals.processed, 100);
  assert.deepEqual(workerCalls, expectedWorkerCalls("core-60d", 10));
});
