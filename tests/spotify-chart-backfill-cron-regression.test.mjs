import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the existing 10h cron remains the only configured Vercel cron", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(config.crons, [
    {
      path: "/api/jobs/spotify-charts/ingest",
      schedule: "0 10 * * *",
    },
  ]);
});
