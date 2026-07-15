import assert from "node:assert/strict";
import test from "node:test";

const { SPOTIFY_CHART_BACKFILL_PHASES, planSpotifyChartBackfillPhase } =
  await import("../src/lib/charts/spotify-chart-backfill-campaigns.ts");
const {
  getAutomaticCharts,
  getBackfillChart,
  getHistoricalSpotifyChartSourceReadiness,
} = await import("../src/lib/charts/spotify-chart-source.ts");

const envNames = [
  "SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE",
  "SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE",
  "SPOTIFY_CHARTS_CITY_BACKFILL_VALIDATED",
  "SPOTIFY_CHARTS_BR_SAO_PAULO_CSV_URL_TEMPLATE",
  "SPOTIFY_CHARTS_BR_RIO_DE_JANEIRO_CSV_URL_TEMPLATE",
  "SPOTIFY_CHARTS_BR_PORTO_ALEGRE_CSV_URL_TEMPLATE",
];
const previousEnv = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);

function setAllHistoricalTemplates() {
  process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE =
    "https://charts.example.test/br/{date}.csv";
  process.env.SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE =
    "https://charts.example.test/global/{date}.csv";
  process.env.SPOTIFY_CHARTS_CITY_BACKFILL_VALIDATED = "1";
  process.env.SPOTIFY_CHARTS_BR_SAO_PAULO_CSV_URL_TEMPLATE =
    "https://charts.example.test/sao-paulo/{date}.csv";
  process.env.SPOTIFY_CHARTS_BR_RIO_DE_JANEIRO_CSV_URL_TEMPLATE =
    "https://charts.example.test/rio/{date}.csv";
  process.env.SPOTIFY_CHARTS_BR_PORTO_ALEGRE_CSV_URL_TEMPLATE =
    "https://charts.example.test/porto-alegre/{date}.csv";
}

setAllHistoricalTemplates();

test.after(() => {
  for (const name of envNames) {
    if (previousEnv[name] === undefined) delete process.env[name];
    else process.env[name] = previousEnv[name];
  }
});

const fixedNow = new Date("2026-07-13T23:45:00.000Z");

test("rollout catalog preserves the requested gradual order", () => {
  assert.deepEqual(
    SPOTIFY_CHART_BACKFILL_PHASES.map((phase) => phase.key),
    [
      "core-30d",
      "core-60d",
      "core-180d",
      "core-365d",
      "core-730d",
      "core-1095d",
      "cities-30d",
      "cities-180d",
    ],
  );
});

test("core phases plan every nested window through three years", () => {
  const plans = [
    planSpotifyChartBackfillPhase("core-30d", fixedNow),
    planSpotifyChartBackfillPhase("core-60d", fixedNow),
    planSpotifyChartBackfillPhase("core-180d", fixedNow),
    planSpotifyChartBackfillPhase("core-365d", fixedNow),
    planSpotifyChartBackfillPhase("core-730d", fixedNow),
    planSpotifyChartBackfillPhase("core-1095d", fixedNow),
  ];

  assert.deepEqual(
    plans.map((plan) => plan.expectedJobs),
    [60, 120, 360, 730, 1460, 2190],
  );
  assert.ok(plans.every((plan) => plan.endDate === "2026-07-12"));

  for (let index = 1; index < plans.length; index += 1) {
    assert.ok(
      plans[index - 1].dates.every((date) => plans[index].dates.includes(date)),
    );
  }
});

test("later phases retain the persisted rollout anchor", () => {
  const plan = planSpotifyChartBackfillPhase(
    "core-1095d",
    new Date("2026-07-15T23:45:00.000Z"),
    "2026-07-12",
  );

  assert.equal(plan.endDate, "2026-07-12");
  assert.equal(plan.startDate, "2023-07-14");
  assert.equal(plan.dates.length, 1095);
  assert.throws(
    () => planSpotifyChartBackfillPhase("core-60d", fixedNow, "2026-07-13"),
    /data ancora/,
  );
});

test("city phases include only SP, RJ and Porto Alegre", () => {
  const thirty = planSpotifyChartBackfillPhase("cities-30d", fixedNow);
  const sixMonths = planSpotifyChartBackfillPhase("cities-180d", fixedNow);

  assert.deepEqual(thirty.regionIds, [
    "BR-SP-SAO-PAULO",
    "BR-RJ-RIO-DE-JANEIRO",
    "BR-RS-PORTO-ALEGRE",
  ]);
  assert.equal(thirty.expectedJobs, 90);
  assert.equal(sixMonths.expectedJobs, 540);
  assert.ok(thirty.dates.every((date) => sixMonths.dates.includes(date)));
});

test("city phase fails closed when one historical template is unavailable", () => {
  delete process.env.SPOTIFY_CHARTS_BR_RIO_DE_JANEIRO_CSV_URL_TEMPLATE;

  try {
    const plan = planSpotifyChartBackfillPhase("cities-30d", fixedNow);
    assert.equal(plan.sourceReady, false);
    assert.deepEqual(
      plan.sourceReadiness
        .filter((source) => !source.supportsHistoricalDates)
        .map((source) => source.regionId),
      ["BR-RJ-RIO-DE-JANEIRO"],
    );
  } finally {
    process.env.SPOTIFY_CHARTS_BR_RIO_DE_JANEIRO_CSV_URL_TEMPLATE =
      "https://charts.example.test/rio/{date}.csv";
  }
});

test("city phases remain blocked until their source format is explicitly validated", () => {
  delete process.env.SPOTIFY_CHARTS_CITY_BACKFILL_VALIDATED;

  try {
    const plan = planSpotifyChartBackfillPhase("cities-30d", fixedNow);
    assert.equal(plan.sourceReady, false);
    assert.ok(
      plan.sourceReadiness.every(
        (source) => source.reason === "historical_city_source_not_validated",
      ),
    );
    assert.equal(getBackfillChart("BR-SP-SAO-PAULO", "top-songs"), null);
  } finally {
    process.env.SPOTIFY_CHARTS_CITY_BACKFILL_VALIDATED = "1";
  }
});

test("daily cron sources remain BR and Global while backfill supports cities", () => {
  assert.deepEqual(
    getAutomaticCharts().map((chart) => [chart.country, chart.metadataMarket]),
    [
      ["BR", "BR"],
      ["GLOBAL", "US"],
    ],
  );
  assert.equal(
    getBackfillChart("BR-SP-SAO-PAULO", "top-songs")?.country,
    "BR-SP-SAO-PAULO",
  );
  assert.equal(
    getBackfillChart("BR-SP-SAO-PAULO", "top-songs")?.metadataMarket,
    "BR",
  );
  assert.equal(getBackfillChart("BR-SP-SAO-PAULO", "other"), null);
  assert.equal(getHistoricalSpotifyChartSourceReadiness().length, 5);
});
