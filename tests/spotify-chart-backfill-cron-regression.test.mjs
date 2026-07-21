import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("services stay private and the two Hobby cron slots remain configured", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );

  assert.equal(config.services.web.framework, "nextjs");
  assert.equal(config.services.playlists_agent.framework, "fastapi");
  assert.deepEqual(config.services.web.bindings, [
    {
      type: "service",
      service: "playlists_agent",
      format: "url",
      env: "PLAYLISTS_AI_PYTHON_URL",
    },
  ]);
  assert.deepEqual(config.rewrites, [
    {
      source: "/(.*)",
      destination: { service: "web" },
    },
  ]);
  assert.deepEqual(config.crons, [
    {
      path: "/api/jobs/spotify-charts/ingest",
      schedule: "0 22 * * *",
    },
    {
      path: "/api/cron/spotify-charts-backfill",
      schedule: "0 11 * * *",
    },
  ]);
});

test("internal cron routes bypass session middleware and authenticate themselves", async () => {
  const middleware = await readFile(
    new URL("../src/middleware.ts", import.meta.url),
    "utf8",
  );

  assert.match(middleware, /pathname === "\/api\/cron\/playlists-ai-learning"/);
  assert.match(middleware, /runtime: "nodejs"/);
});
