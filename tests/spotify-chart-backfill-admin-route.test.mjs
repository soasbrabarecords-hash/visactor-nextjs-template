import assert from "node:assert/strict";
import { mock, test } from "node:test";

let authorized = true;
let workerCalls = 0;
let campaigns = [];
let candidates = [];

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
  },
});

mock.module("@/lib/charts/spotify-chart-backfill-jobs", {
  exports: {
    peekNextSpotifyChartBackfillJobs: async () => candidates,
  },
});

mock.module("@/lib/charts/spotify-chart-backfill-worker", {
  exports: {
    processSpotifyChartBackfillQueue: async () => {
      workerCalls += 1;
      return {
        processed: 3,
        sourceValidated: 3,
        sourceBlocked: false,
        success: 2,
        skipped: 1,
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
  campaigns = [
    campaign("core-30d", "running"),
    campaign("core-180d", "locked"),
    campaign("core-365d", "locked"),
    campaign("cities-30d", "locked"),
    campaign("cities-180d", "locked"),
  ];
  candidates = [job(0), job(1), job(2)];
});

test("admin trigger accepts only the fixed core-30d batch", async () => {
  const response = await POST(request({ phase: "core-30d", limit: 10 }));

  assert.equal(response.status, 400);
  assert.equal(workerCalls, 0);
});

test("admin trigger refuses to run while a later phase is unlocked", async () => {
  campaigns[1] = campaign("core-180d", "ready");

  const response = await POST(request({ phase: "core-30d", limit: 3 }));

  assert.equal(response.status, 409);
  assert.equal(workerCalls, 0);
});

test("admin trigger processes exactly three guarded core jobs", async () => {
  const response = await POST(request({ phase: "core-30d", limit: 3 }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.limit, 3);
  assert.equal(workerCalls, 1);
});
