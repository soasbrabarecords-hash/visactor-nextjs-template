import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(
  new URL(
    "../src/components/workspace/playlists-ai-workbench.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("chat workbench includes voice, rich responses and suggested prompts", () => {
  assert.match(source, /<SpeechInput/);
  assert.match(source, /lang="pt-BR"/);
  assert.match(source, /<MessageResponse/);
  assert.match(source, /<Suggestions/);
  assert.match(source, /Mensagem para o Playlists IA/);
});

test("decision selection stays available and uses one responsive panel", () => {
  assert.equal(source.match(/<DecisionBoard/g)?.length, 1);
  assert.doesNotMatch(source, /onClose=\{\(\) => setDecisionResult\(null\)\}/);
  assert.match(source, /h-\[min\(88dvh,760px\)\]/);
  assert.match(source, /desktop:w-\[420px\]/);
  assert.match(source, /Reabrir seleção de músicas/);
});

test("ranking maturity is communicated honestly", () => {
  assert.match(source, /Ranking personalizado/);
  assert.match(source, /Aprendendo preferências/);
  assert.match(source, /Ranking inteligente/);
  assert.match(source, /Ranking base/);
  assert.match(source, /Confiança dos sinais/);
});
