import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyMusicIntelligenceResponse } from "../src/lib/music-intelligence-model.ts";
import { buildPlaylistSuggestionIntelligence } from "../src/lib/playlist-suggestion-intelligence.ts";

function candidate({
  id,
  name,
  artists,
  country,
  position = 40,
  movement7d = 20,
  action = "add_now",
  opportunityScore = 78,
  genreProfile,
}) {
  return {
    id,
    snapshotTrackId: `${id}-snapshot`,
    spotifyTrackId: id,
    spotifyUrl: `https://open.spotify.com/track/${id}`,
    name,
    artists,
    coverUrl: null,
    primaryCountry: country,
    countries: [country],
    currentPosition: position,
    positions: { [country]: position },
    previousPosition: position + 2,
    movement24h: 2,
    movement7d,
    movement14d: movement7d,
    movement30d: movement7d,
    peakPosition: position,
    streams: 500_000,
    observedDays30: 20,
    isNewEntry: false,
    action,
    actionLabel: action === "add_now" ? "Adicionar agora" : "Observar",
    suggestedPlaylistName: null,
    explanation: "Sinal consistente e risco de ciclo controlado.",
    scores: {
      heatScore: 80,
      momentumScore: 75,
      freshnessScore: 60,
      stabilityScore: 70,
      saturationRisk: 20,
      crossoverScore: 0,
      opportunityScore,
    },
    genreProfile,
  };
}

function intelligence() {
  const response = createEmptyMusicIntelligenceResponse("ready", "Base pronta");
  response.summary.latestChartDate = "2026-07-12";
  response.summary.maxWindow = 365;
  response.summary.statusLabel = "365d validados";
  return response;
}

test("separates BR and Global suggestions, excludes existing tracks and rejects unrelated genres", () => {
  const data = intelligence();
  const existingId = "AAAAAAAAAAAAAAAAAAAAAA";
  const brTrapId = "BBBBBBBBBBBBBBBBBBBBBB";
  const brSertanejoId = "CCCCCCCCCCCCCCCCCCCCCC";
  const globalTrapId = "DDDDDDDDDDDDDDDDDDDDDD";
  const existing = candidate({
    id: existingId,
    name: "Faixa existente",
    artists: "Veigh",
    country: "BR",
  });
  const brTrap = candidate({
    id: brTrapId,
    name: "Faixa nova",
    artists: "Chefin",
    country: "BR",
  });
  const brSertanejo = candidate({
    id: brSertanejoId,
    name: "Moda nova",
    artists: "Gusttavo Lima",
    country: "BR",
  });
  const globalTrap = candidate({
    id: globalTrapId,
    name: "Global nova",
    artists: "Ryu The Runner",
    country: "GLOBAL",
    action: "watch",
  });

  data.candidatePool.BR = [existing, brTrap, brSertanejo];
  data.candidatePool.GLOBAL = [globalTrap];

  const result = buildPlaylistSuggestionIntelligence({
    playlist: {
      name: "TRAP 2027",
      description: "Trap nacional em alta",
      tracks: [
        { id: existingId, name: existing.name, artists: existing.artists },
      ],
    },
    intelligence: data,
  });

  assert.equal(result.summary.playlistGenre, "trap");
  assert.deepEqual(
    result.markets.BR.items.map((track) => track.id),
    [brTrapId],
  );
  assert.deepEqual(
    result.markets.GLOBAL.items.map((track) => track.id),
    [globalTrapId],
  );
  assert.equal(result.markets.BR.items[0].recommendation, "add_now");
  assert.equal(result.markets.GLOBAL.items[0].recommendation, "watch");
  assert.match(result.markets.BR.items[0].explanation, /perfil Trap/);
});

test("uses artist affinity when the candidate genre is not classified", () => {
  const data = intelligence();
  const suggestionId = "EEEEEEEEEEEEEEEEEEEEEE";
  const suggestion = candidate({
    id: suggestionId,
    name: "Som sem palavra-chave",
    artists: "Artista Independente",
    country: "BR",
  });
  data.markets.BR.nextBestOpportunity = suggestion;
  data.markets.BR.addNow = [suggestion];

  const result = buildPlaylistSuggestionIntelligence({
    playlist: {
      name: "Minha seleção",
      description: "",
      tracks: [
        {
          id: "FFFFFFFFFFFFFFFFFFFFFF",
          name: "Outra faixa",
          artists: "Artista Independente",
        },
      ],
    },
    intelligence: data,
  });

  assert.equal(result.markets.BR.items.length, 1);
  assert.equal(result.markets.BR.items[0].playlistFitScore >= 70, true);
  assert.match(result.markets.BR.items[0].explanation, /já presente/);
});

test("prioritizes enriched genre evidence over a raw candidate-pool duplicate", () => {
  const data = intelligence();
  const popId = "GGGGGGGGGGGGGGGGGGGGGG";
  const funkId = "HHHHHHHHHHHHHHHHHHHHHH";
  const rawPop = candidate({
    id: popId,
    name: "Faixa sem pista textual",
    artists: "Artista Global",
    country: "GLOBAL",
  });
  const profiledPop = candidate({
    id: popId,
    name: rawPop.name,
    artists: rawPop.artists,
    country: "GLOBAL",
    genreProfile: {
      primaryGenre: "pop_global",
      genreConfidence: 86,
      confidenceLabel: "alta",
      manualOverride: false,
      label: "Pop Global",
    },
  });
  const profiledFunk = candidate({
    id: funkId,
    name: "Outra faixa sem pista textual",
    artists: "Artista Novo",
    country: "BR",
    genreProfile: {
      primaryGenre: "funk",
      genreConfidence: 82,
      confidenceLabel: "alta",
      manualOverride: false,
      label: "Funk",
    },
  });

  data.candidatePool.GLOBAL = [rawPop];
  data.markets.GLOBAL.watch = [profiledPop];
  data.markets.GLOBAL.nextBestOpportunity = profiledPop;
  data.markets.BR.addNow = [profiledFunk];
  data.markets.BR.nextBestOpportunity = profiledFunk;

  const result = buildPlaylistSuggestionIntelligence({
    playlist: {
      name: "FUNK 2027",
      description: "Funk brasileiro em alta",
      tracks: [],
    },
    intelligence: data,
  });

  assert.deepEqual(
    result.markets.BR.items.map((track) => track.id),
    [funkId],
  );
  assert.equal(result.markets.GLOBAL.items.length, 0);
});
