import assert from "node:assert/strict";
import { mock, test } from "node:test";

let access = {
  allowed: true,
  status: 200,
  workspaceId: "workspace-1",
  userId: "user-1",
};
let savedOverride = null;
let enrichCalls = 0;

const profile = {
  spotifyTrackId: "1234567890123456789012",
  primaryGenre: "funk",
  secondaryGenres: [],
  subgenres: ["baile funk"],
  moodTags: ["festa"],
  energyTags: ["alta"],
  languageSignal: "pt-BR",
  countrySignal: "BR",
  genreConfidence: 88,
  confidenceLabel: "alta",
  genreSources: [],
  genreEvidence: [],
  manualOverride: false,
  manualOverrideEntityType: null,
};

mock.module("@/lib/playlist-os-read-access", {
  exports: { getPlaylistOsReadAccess: async () => access },
});

mock.module("@/lib/track-profile-engine", {
  exports: {
    getTrackGenreProfile: async () => profile,
    saveTrackGenreOverride: async (input) => {
      savedOverride = input;
    },
    deleteTrackGenreOverride: async () => undefined,
    enrichTrackProfile: async () => {
      enrichCalls += 1;
      return profile;
    },
  },
});

const profileRoute =
  await import("../src/app/api/playlist-os/track-profiles/[trackId]/route.ts");
const enrichRoute =
  await import("../src/app/api/playlist-os/track-profiles/enrich/route.ts");

test.beforeEach(() => {
  access = {
    allowed: true,
    status: 200,
    workspaceId: "workspace-1",
    userId: "user-1",
  };
  savedOverride = null;
  enrichCalls = 0;
});

test("blocks profile reads before touching genre data", async () => {
  access = { allowed: false, status: 403, message: "Sem acesso." };
  const response = await profileRoute.GET(
    new Request("http://localhost/api/playlist-os/track-profiles/track"),
    { params: Promise.resolve({ trackId: profile.spotifyTrackId }) },
  );
  assert.equal(response.status, 403);
});

test("saves manual overrides inside the active workspace", async () => {
  const response = await profileRoute.PUT(
    new Request("http://localhost/api/playlist-os/track-profiles/track", {
      method: "PUT",
      body: JSON.stringify({ primaryGenre: "trap", entityType: "track" }),
    }),
    { params: Promise.resolve({ trackId: profile.spotifyTrackId }) },
  );
  assert.equal(response.status, 200);
  assert.equal(savedOverride.workspaceId, "workspace-1");
  assert.equal(savedOverride.entityId, profile.spotifyTrackId);
  assert.equal(savedOverride.primaryGenre, "trap");
});

test("rejects unknown manual genres", async () => {
  const response = await profileRoute.PUT(
    new Request("http://localhost/api/playlist-os/track-profiles/track", {
      method: "PUT",
      body: JSON.stringify({ primaryGenre: "inventado" }),
    }),
    { params: Promise.resolve({ trackId: profile.spotifyTrackId }) },
  );
  assert.equal(response.status, 400);
  assert.equal(savedOverride, null);
});

test("enrichment validates Spotify IDs and stays server-side", async () => {
  const invalid = await enrichRoute.POST(
    new Request("http://localhost/api/playlist-os/track-profiles/enrich", {
      method: "POST",
      body: JSON.stringify({ spotifyTrackId: "invalid" }),
    }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(enrichCalls, 0);

  const valid = await enrichRoute.POST(
    new Request("http://localhost/api/playlist-os/track-profiles/enrich", {
      method: "POST",
      body: JSON.stringify({ spotifyTrackId: profile.spotifyTrackId }),
    }),
  );
  assert.equal(valid.status, 200);
  assert.equal(enrichCalls, 1);
});
