import type {
  PlaylistsAiFeedbackAction,
  PlaylistsAiTrackCard,
} from "@/types/playlists-ai";

export type PlaylistsAiFeedbackDeliveryState = "pending" | "sent" | "failed";

type FeedbackCard = Pick<PlaylistsAiTrackCard, "ranking" | "spotifyTrackId">;

type FeedbackClientOptions = {
  fetcher?: typeof fetch;
  now?: () => Date;
};

export function playlistsAiFeedbackEventId(key: string) {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }
  return `feedback-${(left >>> 0).toString(16).padStart(8, "0")}-${(right >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export async function sendPlaylistsAiFeedback(
  card: FeedbackCard,
  action: PlaylistsAiFeedbackAction,
  feedbackDeliveryStates: Map<string, PlaylistsAiFeedbackDeliveryState>,
  targetPlaylistId: string | null = null,
  retryOnly = false,
  options: FeedbackClientOptions = {},
): Promise<PlaylistsAiFeedbackDeliveryState | "skipped"> {
  const requestId = card.ranking?.requestId;
  const trackId = card.spotifyTrackId;
  if (!requestId || !trackId) return "skipped";

  const feedbackKey = JSON.stringify([
    requestId,
    trackId,
    action,
    targetPlaylistId,
  ]);
  const previousState = feedbackDeliveryStates.get(feedbackKey);
  if (retryOnly && previousState !== "failed") return "skipped";
  if (previousState === "pending" || previousState === "sent") {
    return "skipped";
  }
  feedbackDeliveryStates.set(feedbackKey, "pending");

  const eventId = playlistsAiFeedbackEventId(feedbackKey);
  try {
    const response = await (options.fetcher ?? fetch)(
      "/api/playlists-ia/feedback",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          track_id: trackId,
          action,
          target_playlist_id: targetPlaylistId,
          event_id: eventId,
          occurred_at: (options.now?.() ?? new Date()).toISOString(),
        }),
        cache: "no-store",
        keepalive: true,
      },
    );
    const state = response.ok || response.status < 500 ? "sent" : "failed";
    feedbackDeliveryStates.set(feedbackKey, state);
    return state;
  } catch {
    feedbackDeliveryStates.set(feedbackKey, "failed");
    return "failed";
  }
}
