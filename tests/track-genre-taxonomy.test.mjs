import assert from "node:assert/strict";
import { test } from "node:test";

const { classifyTrackGenre, createGenreEvidence, genresFromTerms } =
  await import("../src/lib/track-genre-taxonomy.ts");

function evidence(source, tags, external = true) {
  return createGenreEvidence({
    source,
    tags,
    detail: `${source} test evidence`,
    external,
  });
}

test("assigns high confidence when two independent sources agree", () => {
  const profile = classifyTrackGenre({
    spotifyTrackId: "1234567890123456789012",
    name: "Faixa teste",
    artists: "Artista teste",
    evidence: [
      evidence("musicbrainz", ["baile funk", "funk carioca"]),
      evidence("lastfm_track", ["brazilian funk", "baile funk"]),
    ].filter(Boolean),
  });

  assert.equal(profile.primaryGenre, "funk");
  assert.equal(profile.confidenceLabel, "alta");
  assert.ok(profile.genreConfidence >= 80);
});

test("assigns medium confidence to external evidence plus workspace context", () => {
  const profile = classifyTrackGenre({
    spotifyTrackId: "2234567890123456789012",
    name: "Faixa teste",
    artists: "Artista teste",
    playlistContext: [{ name: "TRAP 2027", description: "Trap brasileiro" }],
    evidence: [evidence("musicbrainz", ["trap brasileiro"])].filter(Boolean),
  });

  assert.equal(profile.primaryGenre, "trap");
  assert.equal(profile.confidenceLabel, "media");
  assert.ok(profile.genreConfidence >= 60 && profile.genreConfidence < 80);
});

test("keeps artist-only genres provisional at track level", () => {
  const profile = classifyTrackGenre({
    spotifyTrackId: "2734567890123456789012",
    name: "Faixa crossover",
    artists: "Artista multigênero",
    artistGenres: ["sertanejo"],
  });

  assert.equal(profile.primaryGenre, "sertanejo");
  assert.equal(profile.confidenceLabel, "baixa");
  assert.ok(profile.genreConfidence < 60);
});

test("keeps textual-only inference low and explainable", () => {
  const profile = classifyTrackGenre({
    spotifyTrackId: "3234567890123456789012",
    name: "Trap de teste",
    artists: "Artista sem tags",
  });

  assert.equal(profile.primaryGenre, "trap");
  assert.equal(profile.confidenceLabel, "baixa");
  assert.ok(
    profile.genreEvidence.some((item) => item.source === "internal_taxonomy"),
  );
});

test("uses a safe unknown fallback when no source supports a genre", () => {
  const profile = classifyTrackGenre({
    spotifyTrackId: "4234567890123456789012",
    name: "Faixa sem classificação",
    artists: "Artista sem classificação",
  });

  assert.equal(profile.primaryGenre, "desconhecido");
  assert.equal(profile.confidenceLabel, "baixa");
  assert.equal(profile.manualOverride, false);
});

test("manual evidence has absolute precedence", () => {
  const profile = classifyTrackGenre({
    spotifyTrackId: "5234567890123456789012",
    name: "Rock song",
    artists: "Rock Artist",
    evidence: [
      evidence("musicbrainz", ["rock"]),
      createGenreEvidence({
        source: "manual_override",
        tags: ["sertanejo"],
        detail: "Workspace correction",
        external: false,
      }),
    ].filter(Boolean),
  });

  assert.equal(profile.primaryGenre, "sertanejo");
  assert.equal(profile.genreConfidence, 100);
  assert.equal(profile.manualOverride, true);
});

test("does not infer rap from words or artist names that only contain rap", () => {
  assert.deepEqual(genresFromTerms(["Eu Não Sou Terapia - Ao Vivo"]), []);
  assert.deepEqual(genresFromTerms(["O Rappa"]), []);
  assert.deepEqual(genresFromTerms(["rap nacional", "boom bap"]), ["rap"]);
});
