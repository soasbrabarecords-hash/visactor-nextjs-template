import assert from "node:assert/strict";
import { mock, test } from "node:test";

const adminTablesRead = [];

mock.module("@/lib/charts/spotify-chart-service-auth", {
  exports: {
    getSpotifyChartsServiceAccessToken: async () => "test-oauth-token",
    isSpotifyChartsServiceWorkspaceConfigured: () => true,
  },
});

mock.module("@/lib/supabase/admin", {
  exports: {
    createAdminClient: () => ({
      from: (table) => {
        adminTablesRead.push(table);
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({
            data: {
              region_key: "BR",
              source_key: "br",
              country_code: "BR",
              type: "country",
            },
            error: null,
          }),
        };
      },
    }),
  },
});

const {
  SpotifyChartSourceDownloadError,
  downloadResolvedSpotifyChartSource,
  getHistoricalSpotifyChartSourceReadiness,
} = await import("../src/lib/charts/spotify-chart-source.ts");
const { getSpotifyChartRegionSourceDefinition, resolveSpotifyChartSources } =
  await import("../src/lib/charts/spotify-chart-source-resolver.ts");
const { inspectSpotifyChartsCsvContent } =
  await import("../src/lib/spotify-charts-csv.ts");
const { testSpotifyChartHistoricalSource } =
  await import("../src/lib/charts/spotify-chart-source-test.ts");

function officialPayload(date, count = 200) {
  return {
    displayChart: { date },
    entries: Array.from({ length: count }, (_value, index) => {
      const rank = index + 1;
      return {
        chartEntryData: {
          currentRank: rank,
          previousRank: rank + 1,
          rankingMetric: { value: 1_000_000 - rank },
        },
        trackMetadata: {
          trackName: `Track ${rank}`,
          trackUri: `spotify:track:track${String(rank).padStart(17, "0")}`,
          displayImageUri: `https://i.scdn.co/image/${rank}`,
          artists: [{ name: `Artist ${rank}` }],
        },
        albumMetadata: { albumName: `Album ${rank}` },
      };
    }),
  };
}

test("resolver separates the untouched latest path from the official historical source", () => {
  delete process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE;

  const historical = resolveSpotifyChartSources({
    regionId: "BR",
    chartDate: "2026-06-15",
    mode: "historical",
  });
  const latest = resolveSpotifyChartSources({
    regionId: "BR",
    chartDate: "2026-07-12",
    mode: "latest",
  });
  const globalHistorical = resolveSpotifyChartSources({
    regionId: "GLOBAL",
    chartDate: "2026-06-15",
    mode: "historical",
  });

  assert.deepEqual(
    historical.map((source) => source.provider),
    ["spotify_official_api"],
  );
  assert.equal(
    historical[0].url,
    "https://charts-spotify-com-service.spotify.com/auth/v0/charts/regional-br-daily/2026-06-15",
  );
  assert.equal(
    globalHistorical[0].url,
    "https://charts-spotify-com-service.spotify.com/auth/v0/charts/regional-global-daily/2026-06-15",
  );
  assert.deepEqual(
    latest.map((source) => source.provider),
    ["kworb_latest"],
  );
  assert.ok(
    latest.every((source) => source.provider !== "spotify_official_api"),
  );
});

test("official BR historical JSON is authenticated, normalized and accepted by the parser", async () => {
  delete process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE;
  let observedRequest = null;
  const restoreFetch = mock.method(globalThis, "fetch", async (url, init) => {
    observedRequest = { url: String(url), init };
    return Response.json(officialPayload("2026-06-15"), {
      headers: { "content-type": "application/json" },
    });
  });

  try {
    const downloaded = await downloadResolvedSpotifyChartSource({
      regionId: "BR",
      chartDate: "2026-06-15",
      mode: "historical",
    });
    const inspection = inspectSpotifyChartsCsvContent({
      csvText: downloaded.csvText,
      country: "BR",
      chartDate: "2026-06-15",
    });

    assert.equal(
      observedRequest.init.headers.Authorization,
      "Bearer test-oauth-token",
    );
    assert.equal(downloaded.sourceProvider, "spotify_official_api");
    assert.equal(downloaded.chartDate, "2026-06-15");
    assert.equal(inspection.valid, true);
    assert.equal(inspection.parsedRows, 200);
    assert.equal(inspection.uniqueRanks, 200);
    assert.equal(inspection.completeTop200, true);
    assert.equal(inspection.dateEvidencePresent, true);
  } finally {
    restoreFetch.mock.restore();
  }
});

test("administrative source test generates a diagnostic snapshot in memory only", async () => {
  delete process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE;
  adminTablesRead.length = 0;
  const restoreFetch = mock.method(globalThis, "fetch", async () =>
    Response.json(officialPayload("2026-06-15", 200), {
      headers: { "content-type": "application/json" },
    }),
  );

  try {
    const result = await testSpotifyChartHistoricalSource({
      regionId: "BR",
      chartType: "top-songs",
      date: "2026-06-15",
    });

    assert.equal(result.success, true);
    assert.equal(result.snapshotGenerated, true);
    assert.equal(result.snapshot.generated, true);
    assert.equal(result.snapshot.persisted, false);
    assert.equal(result.snapshot.totalTracks, 200);
    assert.equal(result.snapshot.validTracks, 200);
    assert.equal(result.snapshot.completeTop200, true);
    assert.deepEqual(result.snapshot.rankRange, { min: 1, max: 200 });
    assert.equal(result.sideEffects.snapshotPersisted, false);
    assert.equal(result.sideEffects.queueTouched, false);
    assert.equal(result.sideEffects.campaignTouched, false);
    assert.deepEqual(adminTablesRead, ["spotify_chart_regions"]);
  } finally {
    restoreFetch.mock.restore();
  }
});

test("official historical response must prove its requested date", async () => {
  delete process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE;
  const payload = officialPayload("2026-06-15");
  delete payload.displayChart;
  const restoreFetch = mock.method(globalThis, "fetch", async () =>
    Response.json(payload, {
      headers: { "content-type": "application/json" },
    }),
  );

  try {
    await assert.rejects(
      () =>
        downloadResolvedSpotifyChartSource({
          regionId: "BR",
          chartDate: "2026-06-15",
          mode: "historical",
        }),
      (error) => {
        assert.ok(error instanceof SpotifyChartSourceDownloadError);
        assert.match(error.message, /nao informou a data do snapshot/i);
        return true;
      },
    );
  } finally {
    restoreFetch.mock.restore();
  }
});

test("parser rejects an incomplete historical Top 200", async () => {
  delete process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE;
  const restoreFetch = mock.method(globalThis, "fetch", async () =>
    Response.json(officialPayload("2026-06-15", 199), {
      headers: { "content-type": "application/json" },
    }),
  );

  try {
    const downloaded = await downloadResolvedSpotifyChartSource({
      regionId: "BR",
      chartDate: "2026-06-15",
      mode: "historical",
    });
    const inspection = inspectSpotifyChartsCsvContent({
      csvText: downloaded.csvText,
      country: "BR",
      chartDate: "2026-06-15",
    });

    assert.equal(inspection.valid, false);
    assert.equal(inspection.completeTop200, false);
    assert.ok(
      inspection.errors.some((error) => error.code === "incomplete_top_200"),
    );
  } finally {
    restoreFetch.mock.restore();
  }
});

test("parser does not infer a historical date from the requested date", () => {
  const csv = [
    "rank,track_name,artist_names,spotify_track_uri",
    ...Array.from({ length: 200 }, (_value, index) => {
      const rank = index + 1;
      return `${rank},Track ${rank},Artist ${rank},spotify:track:track${String(rank).padStart(17, "0")}`;
    }),
  ].join("\n");
  const inspection = inspectSpotifyChartsCsvContent({
    csvText: csv,
    country: "BR",
    chartDate: "2026-06-15",
  });

  assert.equal(inspection.completeTop200, true);
  assert.equal(inspection.dateEvidencePresent, false);
  assert.equal(inspection.dateMatchesRequest, false);
  assert.equal(inspection.valid, false);
  assert.ok(
    inspection.errors.some((error) => error.code === "missing_date_evidence"),
  );
});

test("known regions honor database source and metadata overrides", () => {
  const definition = getSpotifyChartRegionSourceDefinition("BR", {
    sourceKey: "br-catalog-v2",
    metadataMarket: "PT",
  });
  const historical = resolveSpotifyChartSources({
    regionId: "BR",
    chartDate: "2026-06-15",
    mode: "historical",
    sourceKey: "br-catalog-v2",
    metadataMarket: "PT",
  });

  assert.equal(definition.sourceKey, "br-catalog-v2");
  assert.equal(definition.metadataMarket, "PT");
  assert.equal(historical[0].sourceKey, "br-catalog-v2");
});

test("core readiness no longer depends on an external CSV template", () => {
  delete process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE;
  delete process.env.SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE;

  assert.deepEqual(getHistoricalSpotifyChartSourceReadiness(["BR", "GLOBAL"]), [
    {
      regionId: "BR",
      supportsHistoricalDates: true,
      provider: "spotify_official_api",
      requiredEnvironmentVariable: null,
      reason: null,
    },
    {
      regionId: "GLOBAL",
      supportsHistoricalDates: true,
      provider: "spotify_official_api",
      requiredEnvironmentVariable: null,
      reason: null,
    },
  ]);
});

test("historical source failures retain a safe URL and HTTP status for diagnostics", async () => {
  delete process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE;
  const restoreFetch = mock.method(
    globalThis,
    "fetch",
    async () => new Response("missing token", { status: 401 }),
  );

  try {
    await assert.rejects(
      () =>
        downloadResolvedSpotifyChartSource({
          regionId: "BR",
          chartDate: "2026-06-15",
          mode: "historical",
        }),
      (error) => {
        assert.ok(error instanceof SpotifyChartSourceDownloadError);
        assert.equal(error.attempts.length, 1);
        assert.equal(error.attempts[0].httpStatus, 401);
        assert.equal(error.attempts[0].responseReceived, true);
        assert.match(error.attempts[0].url, /regional-br-daily\/2026-06-15/);
        return true;
      },
    );
  } finally {
    restoreFetch.mock.restore();
  }
});

test("future city templates are resolved centrally with the requested date", () => {
  const key = "SPOTIFY_CHARTS_BR_SAO_PAULO_CSV_URL_TEMPLATE";
  const previous = process.env[key];
  process.env[key] = "https://charts.example.test/{region}/{date}.csv";

  try {
    const sources = resolveSpotifyChartSources({
      regionId: "BR-SP-SAO-PAULO",
      chartDate: "2026-06-15",
      mode: "historical",
    });

    assert.equal(sources.length, 1);
    assert.equal(sources[0].provider, "csv_template");
    assert.equal(
      sources[0].url,
      "https://charts.example.test/br-sao-paulo/2026-06-15.csv",
    );
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});
