import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMusicIntelligenceModel,
  createEmptyMusicIntelligenceResponse,
} from "../src/lib/music-intelligence-model.ts";

const LATEST_DATE = "2026-07-13";
const RISER_ID = "AAAAAAAAAAAAAAAAAAAAAA";
const DROP_ID = "BBBBBBBBBBBBBBBBBBBBBB";
const NEW_ENTRY_ID = "CCCCCCCCCCCCCCCCCCCCCC";

function dateAtOffset(offset) {
  const date = new Date(`${LATEST_DATE}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function snapshotId(country, offset) {
  return `${country}-${dateAtOffset(offset)}`;
}

function buildSnapshots(days = 181) {
  return ["BR", "GLOBAL"].flatMap((country) =>
    Array.from({ length: days }, (_, offset) => ({
      snapshotId: snapshotId(country, offset),
      country,
      chartDate: dateAtOffset(offset),
      tracksCount: 200,
    })),
  );
}

function sourceTrack({
  country,
  offset,
  id,
  name,
  artist,
  position,
  previousPosition = position,
  imageUrl = null,
}) {
  return {
    id: `${id}-${country}-${offset}`,
    snapshotId: snapshotId(country, offset),
    chartDate: dateAtOffset(offset),
    position,
    previousPosition,
    spotifyTrackId: id,
    trackName: name,
    artistName: artist,
    streams: 500_000,
    imageUrl,
  };
}

function buildTracks() {
  const tracks = [];

  for (const country of ["BR", "GLOBAL"]) {
    const base = country === "BR" ? 40 : 60;
    for (let offset = 0; offset <= 30; offset += 1) {
      tracks.push(
        sourceTrack({
          country,
          offset,
          id: RISER_ID,
          name: "Faixa em alta",
          artist: "Artista A",
          position: Math.min(190, base + offset * 4),
          previousPosition: offset === 0 ? base + 4 : base + offset * 4,
          imageUrl: offset === 0 ? "https://images.test/riser.jpg" : null,
        }),
      );
    }
  }

  for (let offset = 0; offset <= 30; offset += 1) {
    tracks.push(
      sourceTrack({
        country: "BR",
        offset,
        id: DROP_ID,
        name: "Faixa em queda",
        artist: "Artista B",
        position: Math.max(10, 150 - offset * 5),
        previousPosition: offset === 0 ? 145 : Math.max(10, 150 - offset * 5),
      }),
    );
  }

  tracks.push(
    sourceTrack({
      country: "BR",
      offset: 0,
      id: NEW_ENTRY_ID,
      name: "Entrada nova",
      artist: null,
      position: 90,
      previousPosition: null,
    }),
  );

  return tracks;
}

test("empty response is stable and safe for the dashboard", () => {
  const result = createEmptyMusicIntelligenceResponse(
    "empty",
    "Sem snapshots.",
    "2026-07-15T00:00:00.000Z",
  );

  assert.equal(result.summary.status, "empty");
  assert.equal(result.summary.totalTracksAnalyzed, 0);
  assert.equal(result.nextBestOpportunity, null);
  assert.deepEqual(result.addNow, []);
  assert.deepEqual(result.crossover, []);
  assert.equal(result.meta.methodologyVersion, "v1");
});

test("model builds explainable add, watch, review and crossover decisions", () => {
  const fallbackImages = new Map([
    [NEW_ENTRY_ID, "https://images.test/new-entry.jpg"],
  ]);
  const tracks = buildTracks();
  const result = buildMusicIntelligenceModel({
    snapshots: buildSnapshots(),
    tracks,
    fallbackImageUrls: fallbackImages,
    generatedAt: "2026-07-15T00:00:00.000Z",
    validatedMaxWindow: 180,
  });

  assert.equal(result.summary.status, "ready");
  assert.equal(result.summary.latestChartDate, LATEST_DATE);
  assert.equal(result.summary.availableDaysBR, 181);
  assert.equal(result.summary.availableDaysGlobal, 181);
  assert.equal(result.summary.totalTracksAnalyzed, tracks.length);
  assert.equal(result.summary.maxWindow, 180);
  assert.deepEqual(result.summary.availableWindows, [7, 14, 30, 60, 90, 180]);

  const riser = result.addNow.find((track) => track.id === RISER_ID);
  const newEntry = result.watch.find((track) => track.id === NEW_ENTRY_ID);
  const drop = result.review.find((track) => track.id === DROP_ID);
  const crossover = result.crossover.find((track) => track.id === RISER_ID);

  assert.ok(riser);
  assert.ok(riser.movement7d > 0);
  assert.ok(riser.scores.momentumScore >= 55);
  assert.match(riser.explanation, /BR e Global|Subiu/);
  assert.ok(crossover);
  assert.ok(crossover.scores.crossoverScore >= 55);

  assert.ok(newEntry);
  assert.equal(newEntry.isNewEntry, true);
  assert.equal(newEntry.artists, "Artista não identificado");
  assert.equal(newEntry.coverUrl, "https://images.test/new-entry.jpg");

  assert.ok(drop);
  assert.ok(drop.movement7d < 0);
  assert.ok(drop.scores.saturationRisk >= 65);
  assert.match(drop.explanation, /Caiu|perdeu força/);

  assert.equal(result.nextBestOpportunity?.id, RISER_ID);
});

test("model does not claim a validated window when the campaign gate is absent", () => {
  const result = buildMusicIntelligenceModel({
    snapshots: buildSnapshots(31),
    tracks: buildTracks(),
    generatedAt: "2026-07-15T00:00:00.000Z",
  });

  assert.equal(result.summary.status, "partial");
  assert.equal(result.summary.statusLabel, "Base parcial");
  assert.equal(result.summary.maxWindow, 0);
  assert.deepEqual(result.summary.availableWindows, []);
});

test("partial response preserves the coverage of the available region", () => {
  const snapshots = buildSnapshots().filter(
    (snapshot) => snapshot.country === "BR",
  );
  const result = buildMusicIntelligenceModel({
    snapshots,
    tracks: [],
    generatedAt: "2026-07-15T00:00:00.000Z",
    validatedMaxWindow: 180,
  });

  assert.equal(result.summary.status, "partial");
  assert.equal(result.summary.statusLabel, "Base parcial");
  assert.equal(result.summary.availableDaysBR, 181);
  assert.equal(result.summary.availableDaysGlobal, 0);
  assert.equal(result.summary.latestChartDate, LATEST_DATE);
});

test("validated window excludes older partial history from the scores", () => {
  const snapshots = buildSnapshots(366);
  const tracks = buildTracks();
  const input = {
    snapshots,
    generatedAt: "2026-07-15T00:00:00.000Z",
    validatedMaxWindow: 180,
  };
  const baseline = buildMusicIntelligenceModel({ ...input, tracks });
  const withOlderPartialData = buildMusicIntelligenceModel({
    ...input,
    tracks: [
      ...tracks,
      sourceTrack({
        country: "BR",
        offset: 365,
        id: RISER_ID,
        name: "Faixa em alta",
        artist: "Artista A",
        position: 1,
      }),
    ],
  });

  const baselineRiser = baseline.addNow.find((track) => track.id === RISER_ID);
  const comparedRiser = withOlderPartialData.addNow.find(
    (track) => track.id === RISER_ID,
  );

  assert.ok(baselineRiser);
  assert.ok(comparedRiser);
  assert.deepEqual(comparedRiser.scores, baselineRiser.scores);
  assert.equal(comparedRiser.peakPosition, baselineRiser.peakPosition);
});

test("model is deterministic for the same source rows", () => {
  const input = {
    snapshots: buildSnapshots(),
    tracks: buildTracks(),
    generatedAt: "2026-07-15T00:00:00.000Z",
    validatedMaxWindow: 180,
  };

  assert.deepEqual(
    buildMusicIntelligenceModel(input),
    buildMusicIntelligenceModel(input),
  );
});
