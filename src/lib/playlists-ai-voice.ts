const PLAYLISTS_AI_MESSAGE_LIMIT = 1600;

export function appendVoiceTranscript(
  current: string,
  transcript: string,
  limit = PLAYLISTS_AI_MESSAGE_LIMIT,
) {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) return current.slice(0, limit);

  const prefix = current.trimEnd();
  return [prefix, cleanTranscript].filter(Boolean).join(" ").slice(0, limit);
}

export function speechInputErrorMessage(errorCode: string) {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    return "Permita o uso do microfone no navegador para ditar.";
  }
  if (errorCode === "audio-capture") {
    return "Não encontrei um microfone disponível.";
  }
  if (errorCode === "no-speech") {
    return "Não ouvi sua voz. Tente falar um pouco mais perto do microfone.";
  }
  if (errorCode === "network") {
    return "O ditado ficou sem conexão. Você ainda pode digitar normalmente.";
  }
  return "Não consegui iniciar o ditado. Você ainda pode digitar normalmente.";
}
