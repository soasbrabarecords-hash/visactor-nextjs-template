import assert from "node:assert/strict";
import { mock, test } from "node:test";

let authorized = true;
let workerCalls = 0;
let workerInput = null;
let peekInput = null;
let campaigns = [];
let candidates = [];

const phases = new Map(
  [
    ["core-30d", ["BR", "GLOBAL"]],
    ["core-60d", ["BR", "GLOBAL"]],
    ["core-180d", ["BR", "GLOBAL"]],
    ["core-365d", ["BR", "GLOBAL"]],
    ["core-730d", ["BR", "GLOBAL"]],
    ["core-1095d", ["BR", "GLOBAL"]],
    ["cities-30d", ["BR-SP-SAO-PAULO"]],
    ["cities-180d", ["BR-SP-SAO-PAULO"]],
  ].map(([key, regionIds]) => [key, { key, regionIds }]),
);

function campaign(phaseKey, status) {
  return {
    phase_key: phaseKey,
    status,
    target_start_date: "2026-06-13",
    target_end_date: "2026-07-12",
  };
}

function job(index) {
  return {
    id: `job-${index}`,
    region_id: index % 2 === 0 ? "BR" : "GLOBAL",
    chart_type: "top-songs",
    period: "daily",
    target_date: "2026-07-12",
  };
}

mock.module("@/lib/charts/spotify-chart-admin-auth", {
  exports: {
    authorizeSpotifyChartsAdminRequest: async () =>
      authorized
        ? { authorized: true, userId: "admin-1" }
        : { authorized: false, status: 403, error: "forbidden" },
  },
});

mock.module("@/lib/charts/spotify-chart-backfill-campaigns", {
  exports: {
    refreshSpotifyChartBackfillCampaignProgress: async () => campaigns,
    getSpotifyChartBackfillCampaigns: async () => campaigns,
    getSpotifyChartBackfillPhaseDefinition: (value) =>
      phases.get(value.trim().toLowerCase()) ?? null,
    isCoreSpotifyChartBackfillPhase: (phase) =>
      phase.regionIds.every((regionId) => ["BR", "GLOBAL"].includes(regionId)),
  },
});

mock.module("@/lib/charts/spotify-chart-backfill-jobs", {
  exports: {
    peekNextSpotifyChartBackfillJobs: async (input) => {
      peekInput = input;
      return candidates;
    },
  },
});

mock.module("@/lib/charts/spotify-chart-backfill-worker", {
  exports: {
    processSpotifyChartBackfillQueue: async (input) => {
      workerCalls += 1;
      workerInput = input;
      return {
        processed: candidates.length,
        sourceValidated: candidates.length,
        sourceBlocked: false,
        success: candidates.length,
        skipped: 0,
        failed: 0,
        retryPending: 0,
        lostLease: 0,
        results: [],
      };
    },
  },
});

const { POST } =
  await import("../src/app/api/settings/admin/spotify-charts/backfill-run/route.ts");

function request(body) {
  return new Request(
    "http://localhost/api/settings/admin/spotify-charts/backfill-run",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify(body),
    },
  );
}

test.beforeEach(() => {
  authorized = true;
  workerCalls = 0;
  workerInput = null;
  peekInput = null;
  campaigns = [
    campaign("core-30d", "completed"),
    campaign("core-60d", "running"),
    campaign("core-180d", "locked"),
    campaign("core-365d", "locked"),
    campaign("core-730d", "locked"),
    campaign("core-1095d", "locked"),
    campaign("cities-30d", "locked"),
    campaign("cities-180d", "locked"),
  ];
  candidates = [job(0), job(1), job(2)];
});

test("admin trigger accepts only cataloged core batches with limit three", async () => {
  const wrongLimit = await POST(request({ phase: "core-60d", limit: 10 }));
  const city = await POST(request({ phase: "cities-30d", limit: 3 }));

  assert.equal(wrongLimit.status, 400);
  assert.equal(city.status, 400);
  assert.equal(workerCalls, 0);
});

test("admin trigger refuses a requested phase that is not running", async () => {
  campaigns[1] = campaign("core-60d", "ready");

  const response = await POST(request({ phase: "core-60d", limit: 3 }));

  assert.equal(response.status, 409);
  assert.equal(workerCalls, 0);
});

test("admin trigger refuses concurrent running campaigns", async () => {
  campaigns[2] = campaign("core-180d", "running");

  const response = await POST(request({ phase: "core-60d", limit: 3 }));

  assert.equal(response.status, 409);
  assert.equal(workerCalls, 0);
});

test("admin trigger processes exactly three guarded core jobs", async () => {
  const response = await POST(request({ phase: "core-60d", limit: 3 }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.limit, 3);
  assert.equal(body.batchSize, 3);
  assert.equal(body.phase, "core-60d");
  assert.equal(peekInput.phaseKey, "core-60d");
  assert.equal(workerInput.phaseKey, "core-60d");
  assert.equal(workerCalls, 1);
});

test("admin trigger closes a phase with a final partial batch", async () => {
  candidates = [job(0)];

  const response = await POST(request({ phase: "core-60d", limit: 3 }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.batchSize, 1);
  assert.equal(workerInput.limit, 1);
  assert.equal(workerCalls, 1);
});
