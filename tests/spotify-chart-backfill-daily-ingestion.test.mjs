import assert from "node:assert/strict";
import test from "node:test";
import {
  getSpotifyChartDailyRepairDates,
  ingestRecentSpotifyCharts,
} from "../src/lib/charts/spotify-chart-daily-ingestion.ts";

const charts = [
  {
    chartType: "top-songs",
    country: "BR",
    metadataMarket: "BR",
    sourceKey: "br",
    csvUrlTemplate: null,
    fallbackUrl: null,
    officialChartAlias: "regional-br-daily",
  },
  {
    chartType: "top-songs",
    country: "GLOBAL",
    metadataMarket: "US",
    sourceKey: "global",
    csvUrlTemplate: null,
    fallbackUrl: null,
    officialChartAlias: "regional-global-daily",
  },
];

test("daily repair window covers the seven completed UTC days oldest first", () => {
  assert.deepEqual(
    getSpotifyChartDailyRepairDates(new Date("2026-07-18T22:00:00.000Z")),
    [
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
    ],
  );
});

test("daily ingestion repairs missing dates and never rolls latest entries backward", async () => {
  const ingestCalls = [];
  const completeSnapshots = charts.flatMap((chart) =>
    ["2026-07-11", "2026-07-12", "2026-07-13", "2026-07-16"].map(
      (chartDate) => ({
        country: chart.country,
        chart_date: chartDate,
      }),
    ),
  );

  const result = await ingestRecentSpotifyCharts({
    now: new Date("2026-07-18T22:00:00.000Z"),
    charts,
    completeSnapshots,
    download: async (chart, chartDate) => ({
      chartDate,
      csvText: "csv",
      sourceUrl: `https://charts.example/${chart.country}/${chartDate}`,
      sourceType: "spotify_official",
      sourceProvider: "spotify_official_api",
      httpStatus: 200,
      contentType: "application/json",
      bytes: 100,
      durationMs: 1,
    }),
    ingest: async (chart, chartDate, download, options) => {
      const downloaded = await download();
      ingestCalls.push({
        country: chart.country,
        chartDate,
        downloadedDate: downloaded.chartDate,
        options,
      });
      return {
        success: true,
        chartType: chart.chartType,
        country: chart.country,
        chartDate,
        sourceUrl: downloaded.sourceUrl,
        sourceType: downloaded.sourceType,
        rowsCount: 200,
      };
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.complete, true);
  assert.equal(result.imported, 6);
  assert.deepEqual(
    ingestCalls.map(({ country, chartDate, options }) => ({
      country,
      chartDate,
      persistLegacyEntries: options.persistLegacyEntries,
    })),
    [
      { country: "BR", chartDate: "2026-07-14", persistLegacyEntries: false },
      {
        country: "GLOBAL",
        chartDate: "2026-07-14",
        persistLegacyEntries: false,
      },
      { country: "BR", chartDate: "2026-07-15", persistLegacyEntries: false },
      {
        country: "GLOBAL",
        chartDate: "2026-07-15",
        persistLegacyEntries: false,
      },
      { country: "BR", chartDate: "2026-07-17", persistLegacyEntries: true },
      {
        country: "GLOBAL",
        chartDate: "2026-07-17",
        persistLegacyEntries: true,
      },
    ],
  );
  assert.ok(
    ingestCalls.every(
      ({ options }) => options.persistSnapshotAtomically === true,
    ),
  );
});

test("an unavailable newest source does not block older gap repair", async () => {
  const importedDates = [];

  const result = await ingestRecentSpotifyCharts({
    now: new Date("2026-07-18T22:00:00.000Z"),
    charts: [charts[0]],
    completeSnapshots: [
      { country: "BR", chart_date: "2026-07-16" },
      { country: "BR", chart_date: "2026-07-11" },
      { country: "BR", chart_date: "2026-07-12" },
      { country: "BR", chart_date: "2026-07-13" },
    ],
    download: async (_chart, chartDate) => {
      if (chartDate === "2026-07-17") {
        throw new Error("HTTP 404");
      }
      return {
        chartDate,
        csvText: "csv",
        sourceUrl: `https://charts.example/BR/${chartDate}`,
        sourceType: "spotify_official",
        sourceProvider: "spotify_official_api",
        httpStatus: 200,
        contentType: "application/json",
        bytes: 100,
        durationMs: 1,
      };
    },
    ingest: async (chart, chartDate, download) => {
      const downloaded = await download();
      importedDates.push(chartDate);
      return {
        success: true,
        chartType: chart.chartType,
        country: chart.country,
        chartDate,
        sourceUrl: downloaded.sourceUrl,
        sourceType: downloaded.sourceType,
        rowsCount: 200,
      };
    },
  });

  assert.deepEqual(importedDates, ["2026-07-14", "2026-07-15"]);
  assert.equal(result.success, true);
  assert.equal(result.complete, false);
  assert.equal(result.imported, 2);
  assert.equal(result.sourceUnavailable, 1);
});
