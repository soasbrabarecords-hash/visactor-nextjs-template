import assert from "node:assert/strict";
import { mock, test } from "node:test";

let rpcResult = null;

mock.module("@/lib/supabase/admin", {
  exports: {
    createAdminClient: () => ({
      rpc: () => ({
        maybeSingle: async () => ({ data: rpcResult, error: null }),
      }),
    }),
  },
});

const { claimNextSpotifyChartBackfillJob, settleSpotifyChartBackfillJob } =
  await import("../src/lib/charts/spotify-chart-backfill-jobs.ts");

test.beforeEach(() => {
  rpcResult = null;
});

test("claim treats Postgres null composite rows as an empty queue", async () => {
  rpcResult = {
    id: null,
    region_id: null,
    lease_token: null,
    status: null,
  };

  const claimed = await claimNextSpotifyChartBackfillJob({
    workerId: "unit-test-worker",
  });

  assert.equal(claimed, null);
});

test("settle treats a fenced or expired lease as no result", async () => {
  rpcResult = {
    id: null,
    region_id: null,
    lease_token: null,
    status: null,
  };

  const settled = await settleSpotifyChartBackfillJob({
    jobId: crypto.randomUUID(),
    leaseToken: crypto.randomUUID(),
    outcome: "success",
  });

  assert.equal(settled, null);
});

test("claim preserves a real reserved job", async () => {
  const job = {
    id: crypto.randomUUID(),
    region_id: "BR",
    lease_token: crypto.randomUUID(),
    status: "running",
  };
  rpcResult = job;

  const claimed = await claimNextSpotifyChartBackfillJob({
    workerId: "unit-test-worker",
  });

  assert.equal(claimed?.id, job.id);
  assert.equal(claimed?.status, "running");
});
