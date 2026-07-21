import assert from "node:assert/strict";
import { mock, test } from "node:test";

let maintenanceResult = { ok: true, value: { queued: true } };
let maintenanceCalls = 0;

mock.module("@/lib/playlists-ai-python-client", {
  exports: {
    runPlaylistAiMaintenance: async () => {
      maintenanceCalls += 1;
      return maintenanceResult;
    },
  },
});

const { GET, maxDuration } =
  await import("../src/app/api/cron/playlists-ai-learning/route.ts");

test.beforeEach(() => {
  maintenanceResult = { ok: true, value: { queued: true } };
  maintenanceCalls = 0;
});

function request(authorization) {
  return new Request("http://localhost/api/cron/playlists-ai-learning", {
    headers: authorization ? { authorization } : undefined,
  });
}

test("learning cron requires CRON_SECRET before contacting Python", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-secret";
  try {
    const missing = await GET(request());
    const wrong = await GET(request("Bearer wrong"));
    assert.equal(missing.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal(maintenanceCalls, 0);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});

test("learning cron reports a safe skip when Python is not configured", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-secret";
  maintenanceResult = { ok: false, reason: "not_configured" };
  try {
    const response = await GET(request("Bearer cron-secret"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.skipped, true);
    assert.equal(body.reason, "not_configured");
    assert.equal(maintenanceCalls, 1);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});

test("learning cron forwards a bounded maintenance run without Spotify mutations", async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "cron-secret";
  try {
    const response = await GET(request("Bearer cron-secret"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.skipped, false);
    assert.deepEqual(body.maintenance, { queued: true });
    assert.equal(maxDuration, 60);
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});
