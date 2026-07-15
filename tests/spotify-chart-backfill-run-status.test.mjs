import assert from "node:assert/strict";
import { mock, test } from "node:test";

let latestRun = null;
let completeSnapshot = null;
let completeSnapshotReads = 0;

function queryFor(table) {
  const query = {
    select() {
      return query;
    },
    order() {
      return query;
    },
    limit() {
      return query;
    },
    eq() {
      return query;
    },
    async maybeSingle() {
      if (table === "spotify_chart_runs") {
        return { data: latestRun, error: null };
      }

      completeSnapshotReads += 1;
      return { data: completeSnapshot, error: null };
    },
  };

  return query;
}

mock.module("@/lib/supabase/server", {
  exports: {
    createClient: async () => ({ from: (table) => queryFor(table) }),
  },
});

mock.module("@/lib/supabase/admin", {
  exports: { createAdminClient: () => null },
});

const { getLatestSpotifyChartRun } =
  await import("../src/lib/charts/spotify-chart-runs.ts");

function run(status) {
  return {
    id: "run-1",
    chart_type: "top-songs",
    country: "BR",
    chart_date: "2026-06-03",
    source_url: null,
    source_type: "spotify_charts_api",
    status,
    rows_count: status === "success" ? 200 : 0,
    error_message: status === "error" ? "duplicate key" : null,
    started_at: "2026-07-15T02:07:55.754Z",
    finished_at: "2026-07-15T02:07:55.812Z",
  };
}

test.beforeEach(() => {
  latestRun = run("error");
  completeSnapshot = null;
  completeSnapshotReads = 0;
});

test("an error is reconciled only when its exact Top 200 now exists", async () => {
  completeSnapshot = { snapshot_id: "snapshot-1" };

  const result = await getLatestSpotifyChartRun("br");

  assert.equal(result?.status, "error");
  assert.equal(result?.resolved_by_complete_snapshot, true);
  assert.equal(result?.error_message, "duplicate key");
  assert.equal(completeSnapshotReads, 1);
});

test("an unresolved error remains visible", async () => {
  const result = await getLatestSpotifyChartRun("BR");

  assert.equal(result?.resolved_by_complete_snapshot, false);
  assert.equal(completeSnapshotReads, 1);
});

test("a successful latest run does not need a reconciliation query", async () => {
  latestRun = run("success");

  const result = await getLatestSpotifyChartRun("BR");

  assert.equal(result?.status, "success");
  assert.equal(result?.resolved_by_complete_snapshot, false);
  assert.equal(completeSnapshotReads, 0);
});
