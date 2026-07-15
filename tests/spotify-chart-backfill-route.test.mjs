import assert from "node:assert/strict";
import { mock, test } from "node:test";

const persistedCampaigns = [
  {
    rollout_key: "spotify-charts-historical-v1",
    phase_key: "core-30d",
    phase_order: 10,
    target_end_date: "2026-07-12",
  },
];

mock.module("@/lib/supabase/admin", {
  exports: {
    createAdminClient: () => ({
      from: () => {
        const query = {
          select() {
            return query;
          },
          eq() {
            return query;
          },
          order: async () => ({ data: persistedCampaigns, error: null }),
        };
        return query;
      },
    }),
  },
});

const { GET, maxDuration } =
  await import("../src/app/api/cron/spotify-charts-backfill/route.ts");

const previousBrTemplate = process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE;
const previousGlobalTemplate =
  process.env.SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE;
const previousServiceWorkspace = process.env.SPOTIFY_CHARTS_SOURCE_WORKSPACE_ID;
process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE =
  "https://charts.example.test/br/{date}.csv";
process.env.SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE =
  "https://charts.example.test/global/{date}.csv";
process.env.SPOTIFY_CHARTS_SOURCE_WORKSPACE_ID = "test-workspace";

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

  if (previousServiceWorkspace === undefined) {
    delete process.env.SPOTIFY_CHARTS_SOURCE_WORKSPACE_ID;
  } else {
    process.env.SPOTIFY_CHARTS_SOURCE_WORKSPACE_ID = previousServiceWorkspace;
  }
});

function request(query = "", authorization) {
  return new Request(
    `http://localhost/api/cron/spotify-charts-backfill${query}`,
    {
      headers: authorization ? { authorization } : undefined,
    },
  );
}

async function readJson(response) {
  return {
    body: await response.json(),
    status: response.status,
  };
}

test("route rejects missing or invalid cron authorization", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "unit-test-secret";

  try {
    const missing = await readJson(await GET(request("?dry_run=1&days=7")));
    const wrong = await readJson(
      await GET(request("?dry_run=1&days=7", "Bearer wrong")),
    );

    assert.equal(missing.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(missing.body.success, false);
    assert.equal(wrong.body.success, false);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});

test("historical cron reserves five minutes for bounded multi-round drains", () => {
  assert.equal(maxDuration, 300);
});

test("route rejects requests when CRON_SECRET is not configured", async () => {
  const previousSecret = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;

  try {
    const response = await readJson(
      await GET(request("?dry_run=1&days=7", "Bearer undefined")),
    );

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
  } finally {
    if (previousSecret !== undefined) process.env.CRON_SECRET = previousSecret;
  }
});

test("route validates limit, days and dry_run before doing work", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "unit-test-secret";
  const auth = "Bearer unit-test-secret";

  try {
    const invalidLimit = await readJson(
      await GET(request("?dry_run=1&limit=11", auth)),
    );
    const invalidDays = await readJson(
      await GET(request("?dry_run=1&days=8", auth)),
    );
    const invalidDryRun = await readJson(
      await GET(request("?dry_run=true&days=7", auth)),
    );
    const invalidPhase = await readJson(
      await GET(request("?dry_run=1&phase=unknown", auth)),
    );
    const mixedPlanner = await readJson(
      await GET(request("?dry_run=1&phase=core-30d&days=30", auth)),
    );

    assert.equal(invalidLimit.status, 400);
    assert.match(invalidLimit.body.error, /limit/);
    assert.equal(invalidDays.status, 400);
    assert.match(invalidDays.body.error, /days/);
    assert.equal(invalidDryRun.status, 400);
    assert.match(invalidDryRun.body.error, /dry_run/);
    assert.equal(invalidPhase.status, 400);
    assert.match(invalidPhase.body.error, /Fase/);
    assert.equal(mixedPlanner.status, 400);
    assert.match(mixedPlanner.body.error, /nunca os dois/);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});

test("route dry-run plans the first gradual phase without touching the queue", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "unit-test-secret";

  try {
    const response = await readJson(
      await GET(
        request("?dry_run=1&phase=core-30d&limit=3", "Bearer unit-test-secret"),
      ),
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.seedComplete, true);
    assert.equal(response.body.phase.phaseKey, "core-30d");
    assert.equal(response.body.phase.expectedJobs, 60);
    assert.deepEqual(response.body.phase.regionIds, ["BR", "GLOBAL"]);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});

test("route dry-run exposes the complete long-range core catalog", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "unit-test-secret";

  try {
    const expectations = [
      ["core-60d", 120, "2026-05-14"],
      ["core-79d", 158, "2026-04-25"],
      ["core-180d", 360, "2026-01-14"],
      ["core-365d", 730, "2025-07-13"],
      ["core-730d", 1460, "2024-07-13"],
      ["core-1095d", 2190, "2023-07-14"],
    ];

    for (const [phase, expectedJobs, startDate] of expectations) {
      const response = await readJson(
        await GET(
          request(
            `?dry_run=1&phase=${phase}&limit=3`,
            "Bearer unit-test-secret",
          ),
        ),
      );

      assert.equal(response.status, 200);
      assert.equal(response.body.phase.phaseKey, phase);
      assert.equal(response.body.phase.expectedJobs, expectedJobs);
      assert.equal(response.body.phase.startDate, startDate);
      assert.equal(response.body.phase.endDate, "2026-07-12");
      assert.deepEqual(response.body.phase.regionIds, ["BR", "GLOBAL"]);
    }
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});

test("route dry-run plans fourteen jobs without invoking the worker", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "unit-test-secret";

  try {
    const response = await readJson(
      await GET(
        request("?dry_run=1&days=7&limit=1", "Bearer unit-test-secret"),
      ),
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.dryRun, true);
    assert.equal(response.body.limit, 1);
    assert.deepEqual(response.body.seed.regionIds, ["BR", "GLOBAL"]);
    assert.equal(response.body.seed.dates.length, 7);
    assert.equal(response.body.seed.jobs.length, 14);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});

test("route dry-run supports thirty days and the default worker limit", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "unit-test-secret";

  try {
    const response = await readJson(
      await GET(request("?dry_run=1&days=30", "Bearer unit-test-secret")),
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.limit, 3);
    assert.equal(response.body.seed.dates.length, 30);
    assert.equal(response.body.seed.jobs.length, 60);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});

test("route dry-run keeps core regions available through the official historical API", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "unit-test-secret";
  delete process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE;
  delete process.env.SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE;

  try {
    const response = await readJson(
      await GET(request("?dry_run=1&days=7", "Bearer unit-test-secret")),
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.seedComplete, true);
    assert.equal(response.body.seed.jobs.length, 14);
    assert.equal(response.body.seed.unavailableRegions.length, 0);
  } finally {
    process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE =
      "https://charts.example.test/br/{date}.csv";
    process.env.SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE =
      "https://charts.example.test/global/{date}.csv";

    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});
