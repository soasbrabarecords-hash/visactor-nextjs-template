import assert from "node:assert/strict";
import test from "node:test";

const {
  getRecentSpotifyChartBackfillDates,
  planRecentSpotifyChartBackfillJobs,
} = await import("../src/lib/charts/spotify-chart-backfill-jobs.ts");

const previousBrTemplate = process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE;
const previousGlobalTemplate =
  process.env.SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE;
process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE =
  "https://charts.example.test/br/{date}.csv";
process.env.SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE =
  "https://charts.example.test/global/{date}.csv";

test.after(() => {
  if (previousBrTemplate === undefined) {
    delete process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE;
  } else {
    process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE = previousBrTemplate;
  }

  if (previousGlobalTemplate === undefined) {
    delete process.env.SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE;
  } else {
    process.env.SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE = previousGlobalTemplate;
  }
});

const fixedNow = new Date("2026-07-13T23:45:00.000Z");

test("planner creates the last seven completed UTC days", () => {
  const dates = getRecentSpotifyChartBackfillDates(7, fixedNow);

  assert.equal(dates.length, 7);
  assert.equal(dates[0], "2026-07-12");
  assert.equal(dates.at(-1), "2026-07-06");
  assert.equal(new Set(dates).size, dates.length);
  assert.ok(dates.every((date) => date < "2026-07-13"));
});

test("planner creates exactly BR and GLOBAL jobs for seven days", () => {
  const plan = planRecentSpotifyChartBackfillJobs(7, fixedNow);

  assert.deepEqual([...plan.regionIds], ["BR", "GLOBAL"]);
  assert.equal(plan.jobs.length, 14);
  assert.equal(
    new Set(
      plan.jobs.map(
        (job) =>
          `${job.region_id}:${job.chart_type}:${job.period}:${job.target_date}`,
      ),
    ).size,
    14,
  );
  assert.ok(
    plan.jobs.every(
      (job) => job.chart_type === "top-songs" && job.period === "daily",
    ),
  );
});

test("planner creates sixty unique jobs for thirty days", () => {
  const plan = planRecentSpotifyChartBackfillJobs(30, fixedNow);

  assert.equal(plan.dates.length, 30);
  assert.equal(plan.jobs.length, 60);
  assert.equal(plan.dates[0], "2026-07-12");
  assert.equal(plan.dates.at(-1), "2026-06-13");
  assert.equal(
    new Set(
      plan.jobs.map(
        (job) => `${job.region_id}:${job.period}:${job.target_date}`,
      ),
    ).size,
    60,
  );
});

test("planner rejects unsupported windows", () => {
  assert.throws(
    () => getRecentSpotifyChartBackfillDates(8, fixedNow),
    /days deve ser 7 ou 30/,
  );
});

test("planner excludes a region without a date-aware historical source", () => {
  process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE =
    "https://charts.example.test/br/latest.csv";

  try {
    const plan = planRecentSpotifyChartBackfillJobs(7, fixedNow);

    assert.deepEqual(plan.regionIds, ["GLOBAL"]);
    assert.equal(plan.jobs.length, 7);
    assert.deepEqual(plan.unavailableRegions, [
      {
        regionId: "BR",
        supportsHistoricalDates: false,
        requiredEnvironmentVariable: "SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE",
        reason: "template_missing_date_placeholder",
      },
    ]);
  } finally {
    process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE =
      "https://charts.example.test/br/{date}.csv";
  }
});
