import "server-only";

type SpotifyOEmbedResponse = {
  thumbnail_url?: string;
};

const MAX_CACHED_COVERS = 2000;
const coverCache = new Map<string, string>();

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function cacheCover(trackId: string, imageUrl: string) {
  if (coverCache.size >= MAX_CACHED_COVERS) {
    const oldestTrackId = coverCache.keys().next().value;

    if (oldestTrackId) {
      coverCache.delete(oldestTrackId);
    }
  }

  coverCache.set(trackId, imageUrl);
}

async function fetchSpotifyOEmbedCover(
  trackId: string,
  attempt = 0,
): Promise<string | null> {
  const cachedCover = coverCache.get(trackId);

  if (cachedCover) {
    return cachedCover;
  }

  const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
  const response = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );

  if (response.status === 429 && attempt < 3) {
    const retryAfterSeconds = Number(response.headers.get("Retry-After"));
    const retryDelay = Number.isFinite(retryAfterSeconds)
      ? Math.min(Math.max(retryAfterSeconds * 1000, 500), 4000)
      : 750 * (attempt + 1);

    await wait(retryDelay);
    return fetchSpotifyOEmbedCover(trackId, attempt + 1);
  }

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as SpotifyOEmbedResponse;
  const imageUrl = payload.thumbnail_url?.trim() || null;

  if (imageUrl) {
    cacheCover(trackId, imageUrl);
  }

  return imageUrl;
}

export async function fetchSpotifyOEmbedCoverUrls(
  trackIds: string[],
  { concurrency = 3 }: { concurrency?: number } = {},
) {
  const uniqueTrackIds = Array.from(
    new Set(
      trackIds
        .map((trackId) => trackId.trim())
        .filter((trackId) => /^[A-Za-z0-9]{22}$/.test(trackId)),
    ),
  );
  const covers = new Map<string, string>();
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < uniqueTrackIds.length) {
      const trackId = uniqueTrackIds[nextIndex];
      nextIndex += 1;

      const imageUrl = await fetchSpotifyOEmbedCover(trackId).catch(() => null);

      if (imageUrl) {
        covers.set(trackId, imageUrl);
      }

      await wait(150);
    }
  }

  const workerCount = Math.min(
    Math.max(1, concurrency),
    uniqueTrackIds.length,
  );

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return covers;
}
