import assert from "node:assert/strict";
import { mock, test } from "node:test";

let authUser = null;
const sourceTestCalls = [];
let sourceTestError = null;

mock.module("@/lib/supabase/server", {
  exports: {
    createClient: async () => ({
      auth: {
        getUser: async () => ({
          data: { user: authUser },
          error: authUser ? null : new Error("not signed in"),
        }),
      },
    }),
  },
});

class TestValidationError extends Error {}

mock.module("@/lib/charts/spotify-chart-source-test", {
  exports: {
    SpotifyChartSourceValidationError: TestValidationError,
    summarizeSpotifyChartHistoricalProbe: () => ({}),
    testSpotifyChartHistoricalSource: async (input) => {
      if (sourceTestError) throw sourceTestError;
      sourceTestCalls.push(input);
      return {
        success: true,
        checkedAt: "2026-07-13T12:00:00.000Z",
        request: input,
        source: {
          url: `https://charts.example.test/${input.regionId}/${input.date}`,
        },
        response: { received: true, songCount: 200 },
        parser: { working: true },
        snapshotGenerated: true,
        snapshot: {
          generated: true,
          persisted: false,
          totalTracks: 200,
        },
        errors: [],
        sideEffects: {
          queueTouched: false,
          campaignTouched: false,
          snapshotPersisted: false,
        },
      };
    },
  },
});

const { SpotifyChartSourceDownloadError } =
  await import("../src/lib/charts/spotify-chart-source.ts");
const { POST } =
  await import("../src/app/api/settings/admin/spotify-charts/source-test/route.ts");

function request(body) {
  return new Request(
    "http://localhost/api/settings/admin/spotify-charts/source-test",
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
  authUser = null;
  sourceTestCalls.length = 0;
  sourceTestError = null;
  process.env.SPOTIFY_CHARTS_ADMIN_USER_ID = "admin-1";
});

test("source test rejects anonymous and non-admin users", async () => {
  const anonymous = await POST(request({ regionId: "BR", date: "2026-06-15" }));
  authUser = { id: "user-1", email: "user@example.com" };
  const forbidden = await POST(request({ regionId: "BR", date: "2026-06-15" }));

  assert.equal(anonymous.status, 401);
  assert.equal(forbidden.status, 403);
  assert.equal(sourceTestCalls.length, 0);
});

test("source test accepts only configured chart coordinates, never an arbitrary URL", async () => {
  authUser = { id: "admin-1", email: "contato@soasbraba.com" };

  const invalid = await POST(
    request({
      regionId: "https://attacker.example/",
      date: "2026-06-15",
      url: "https://attacker.example/",
    }),
  );

  assert.equal(invalid.status, 400);
  assert.equal(sourceTestCalls.length, 0);
});

test("source test reports parser and snapshot without touching campaigns", async () => {
  authUser = { id: "admin-1", email: "CONTATO@SOASBRABA.COM" };

  const response = await POST(
    request({ regionId: "global", chartType: "top-songs", date: "2026-06-15" }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
  assert.deepEqual(sourceTestCalls, [
    { regionId: "GLOBAL", chartType: "top-songs", date: "2026-06-15" },
  ]);
  assert.equal(body.response.songCount, 200);
  assert.equal(body.parser.working, true);
  assert.equal(body.snapshotGenerated, true);
  assert.equal(body.snapshot.generated, true);
  assert.equal(body.snapshot.persisted, false);
  assert.equal(body.sideEffects.queueTouched, false);
  assert.equal(body.sideEffects.campaignTouched, false);
  assert.equal(body.sideEffects.snapshotPersisted, false);
});

test("source test reports the resolved URL and HTTP failure without consuming a job", async () => {
  authUser = { id: "admin-1", email: "contato@soasbraba.com" };
  sourceTestError = new SpotifyChartSourceDownloadError(
    "historical source failed",
    [
      {
        provider: "spotify_official_api",
        url: "https://charts-spotify-com-service.spotify.com/auth/v0/charts/regional-br-daily/2026-06-15",
        responseReceived: true,
        httpStatus: 401,
        error: "Spotify returned 401",
      },
    ],
  );

  const response = await POST(request({ regionId: "BR", date: "2026-06-15" }));
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.source.provider, "spotify_official_api");
  assert.match(body.source.url, /regional-br-daily\/2026-06-15/);
  assert.equal(body.response.received, true);
  assert.equal(body.response.httpStatus, 401);
  assert.equal(body.snapshotGenerated, false);
  assert.equal(body.snapshot.generated, false);
  assert.equal(body.sideEffects.queueTouched, false);
});
