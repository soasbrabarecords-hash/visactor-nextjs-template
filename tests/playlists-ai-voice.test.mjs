import assert from "node:assert/strict";
import { test } from "node:test";

const { appendVoiceTranscript, speechInputErrorMessage } =
  await import("../src/lib/playlists-ai-voice.ts");

test("voice transcript preserves the draft and enforces the message limit", () => {
  assert.equal(
    appendVoiceTranscript("Descubra trap", "novo no Brasil"),
    "Descubra trap novo no Brasil",
  );
  assert.equal(appendVoiceTranscript("Texto", "   "), "Texto");
  assert.equal(appendVoiceTranscript("12345", "67890", 8), "12345 67");
});

test("voice errors remain actionable without blocking typed input", () => {
  assert.match(speechInputErrorMessage("not-allowed"), /Permita/);
  assert.match(speechInputErrorMessage("audio-capture"), /microfone/);
  assert.match(speechInputErrorMessage("network"), /digitar normalmente/);
});
