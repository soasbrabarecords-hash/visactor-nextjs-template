import assert from "node:assert/strict";
import { mock, test } from "node:test";

const rows = Array.from({ length: 1095 }, (_value, index) => {
  const date = new Date("2026-07-12T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() - index);

  return {
    snapshot_id: `snapshot-${String(index).padStart(4, "0")}`,
    chart_date: date.toISOString().slice(0, 10),
  };
});
const requestedRanges = [];

mock.module("@/lib/spotify-user", {
  exports: {
    fetchSpotifyTrackCoverUrls: async () => new Map(),
  },
});

mock.module("@/lib/supabase/admin", {
  exports: {
    createAdminClient: () => null,
  },
});

mock.module("@/lib/supabase/server", {
  exports: {
    createClient: async () => ({
      from(table) {
        assert.equal(table, "spotify_chart_complete_snapshots");

        const query = {
          select(columns, options) {
            assert.equal(columns, "snapshot_id,chart_date");
            assert.deepEqual(options, { count: "exact" });
            return query;
          },
          eq(column, value) {
            assert.equal(column, "country");
            assert.equal(value, "BR");
            return query;
          },
          order() {
            return query;
          },
          async range(from, to) {
            requestedRanges.push([from, to]);
            return {
              data: rows.slice(from, to + 1),
              error: null,
              count: rows.length,
            };
          },
        };

        return query;
      },
    }),
  },
});

const { getSnapshotDates } = await import("../src/lib/chart-snapshots.ts");

test("snapshot dates paginate past the Supabase 1000-row response limit", async () => {
  const dates = await getSnapshotDates("br");

  assert.equal(dates.length, 1095);
  assert.equal(dates[0], "2026-07-12");
  assert.equal(dates.at(-1), rows.at(-1).chart_date);
  assert.equal(new Set(dates).size, 1095);
  assert.deepEqual(requestedRanges, [
    [0, 999],
    [1000, 1999],
  ]);
});
