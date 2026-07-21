import assert from "node:assert/strict";
import { mock, test } from "node:test";

let ingestionCalls = 0;
let enrichmentInput = null;
let maintenanceCalls = 0;

mock.module("@/lib/charts/spotify-chart-daily-ingestion", {
  exports: {
    ingestRecentSpotifyCharts: async () => {
      ingestionCalls += 1;
      return { success: true, imported: 0 };
    },
  },
});

mock.module("@/lib/charts/spotify-chart-genre-enrichment", {
  exports: {
    SPOTIFY_CHART_GENRE_ENRICHMENT_DEFAULT_LIMIT: 60,
    SPOTIFY_CHART_GENRE_ENRICHMENT_MAX_LIMIT: 100,
    enrichLatestSpotifyChartGenres: async (input) => {
      enrichmentInput = input;
      return { processed: input.limit, classified: input.limit };
    },
  },
});

mock.module("@/lib/playlists-ai-python-client", {
  exports: {
    runPlaylistAiMaintenance: async () => {
      maintenanceCalls += 1;
      return { ok: true, value: { promoted: 0 } };
    },
  },
});

const route =
  await import("../src/app/api/jobs/spotify-charts/ingest/route.ts");

test.beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  ingestionCalls = 0;
  enrichmentInput = null;
  maintenanceCalls = 0;
});

test("keeps genre enrichment behind the existing cron secret", async () => {
  const response = await route.GET(
    new Request(
      "http://localhost/api/jobs/spotify-charts/ingest?genres_only=1",
    ),
  );

  assert.equal(response.status, 401);
  assert.equal(ingestionCalls, 0);
  assert.equal(enrichmentInput, null);
  assert.equal(maintenanceCalls, 0);
});

test("supports a protected genre-only drain without rerunning chart ingestion", async () => {
  const response = await route.GET(
    new Request(
      "http://localhost/api/jobs/spotify-charts/ingest?genres_only=1&genre_limit=80",
      { headers: { authorization: "Bearer test-secret" } },
    ),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.genresOnly, true);
  assert.equal(ingestionCalls, 0);
  assert.equal(maintenanceCalls, 0);
  assert.equal(enrichmentInput.limit, 80);
  assert.equal(payload.genreEnrichment.classified, 80);
});

test("runs genre enrichment after the normal daily repair", async () => {
  const response = await route.GET(
    new Request("http://localhost/api/jobs/spotify-charts/ingest", {
      headers: { authorization: "Bearer test-secret" },
    }),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(ingestionCalls, 1);
  assert.equal(maintenanceCalls, 1);
  assert.equal(enrichmentInput.limit, 60);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.playlistsAiLearning, {
    ok: true,
    value: { promoted: 0 },
  });
});
