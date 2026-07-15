import assert from "node:assert/strict";
import { mock, test } from "node:test";

let accessResult = {
  allowed: true,
  status: 200,
  workspaceId: "workspace-1",
  userId: "user-1",
};
let serviceError = null;
let serviceCalls = 0;

const responseData = {
  summary: {
    latestChartDate: "2026-07-13",
    availableDaysBR: 181,
    availableDaysGlobal: 181,
    totalTracksAnalyzed: 72400,
    totalCandidates: 320,
    maxWindow: 180,
    availableWindows: [7, 14, 30, 60, 90, 180],
    windowStart: "2026-01-15",
    windowEnd: "2026-07-13",
    status: "ready",
    statusLabel: "Base íntegra · 180d",
    statusDetail: "Base pronta.",
    newEntries: 4,
    topRisers: 8,
    biggestDrops: 3,
  },
  nextBestOpportunity: null,
  addNow: [],
  watch: [],
  review: [],
  crossover: [],
  signals: {
    topRisers: [],
    newEntries: [],
    biggestDrops: [],
    risingArtists: [],
  },
  candidatePool: {
    BR: [{ id: "internal-only" }],
    GLOBAL: [],
  },
  meta: {
    generatedAt: "2026-07-15T00:00:00.000Z",
    methodologyVersion: "v1",
    source: "spotify_chart_complete_snapshots",
  },
};

mock.module("@/lib/playlist-os-read-access", {
  exports: {
    getPlaylistOsReadAccess: async () => accessResult,
  },
});

mock.module("@/lib/music-intelligence", {
  exports: {
    getMusicIntelligence: async () => {
      serviceCalls += 1;
      if (serviceError) {
        throw serviceError;
      }
      return responseData;
    },
  },
});

const { GET } =
  await import("../src/app/api/playlist-os/music-intelligence/route.ts");

test.beforeEach(() => {
  accessResult = {
    allowed: true,
    status: 200,
    workspaceId: "workspace-1",
    userId: "user-1",
  };
  serviceError = null;
  serviceCalls = 0;
});

test("route blocks anonymous access before reading chart data", async () => {
  accessResult = {
    allowed: false,
    status: 401,
    message: "Sessão necessária.",
  };

  const response = await GET();
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(serviceCalls, 0);
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
});

test("route blocks users without Playlist OS access", async () => {
  accessResult = {
    allowed: false,
    status: 403,
    message: "Sem acesso ao Playlist OS.",
  };

  const response = await GET();

  assert.equal(response.status, 403);
  assert.equal(serviceCalls, 0);
});

test("route returns the complete intelligence contract", async () => {
  const response = await GET();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(serviceCalls, 1);
  assert.equal(body.summary.maxWindow, 180);
  assert.deepEqual(body.addNow, []);
  assert.equal("candidatePool" in body, false);
  assert.equal(body.meta.methodologyVersion, "v1");
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
});

test("route hides internal errors behind a stable response", async () => {
  serviceError = new Error("database details must stay private");
  const originalStderrWrite = process.stderr.write;
  process.stderr.write = () => true;

  try {
    const response = await GET();
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.success, false);
    assert.doesNotMatch(body.message, /database details/);
  } finally {
    process.stderr.write = originalStderrWrite;
  }
});
