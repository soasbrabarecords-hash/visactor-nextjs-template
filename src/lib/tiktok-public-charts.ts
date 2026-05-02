import "server-only";

import {
  searchSpotifyTracks,
  type SpotifyTrackRecord,
} from "@/lib/spotify";

export type TikTokPublicChartTrack = {
  rank: number;
  trackName: string;
  artistName: string;
  movementLabel: string;
  coverUrl: string | null;
  spotifyUrl: string | null;
};

export type TikTokPublicChart = {
  source: "kworb-br";
  snapshotDate: string | null;
  tracks: TikTokPublicChartTrack[];
};

type CacheEntry = {
  value: TikTokPublicChart;
  expiresAt: number;
};

const TIKTOK_PUBLIC_CHART_TTL_MS = 30 * 60 * 1000;
const TIKTOK_PUBLIC_ARTWORK_TTL_MS = 6 * 60 * 60 * 1000;

let cachedChart: CacheEntry | null = null;
let inFlightChart: Promise<TikTokPublicChart> | null = null;
const artworkCache = new Map<
  string,
  {
    coverUrl: string | null;
    spotifyUrl: string | null;
    expiresAt: number;
  }
>();

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function htmlToLines(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "\n")
      .replace(/<[^>]+>/g, "\n"),
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitArtistAndTitle(value: string) {
  const separatorIndex = value.indexOf(" - ");

  if (separatorIndex === -1) {
    return {
      artistName: value.trim(),
      trackName: value.trim(),
    };
  }

  return {
    artistName: value.slice(0, separatorIndex).trim(),
    trackName: value.slice(separatorIndex + 3).trim(),
  };
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreSpotifyMatch(
  sourceTrack: TikTokPublicChartTrack,
  candidate: SpotifyTrackRecord,
) {
  const sourceTitle = normalizeText(sourceTrack.trackName);
  const sourceArtist = normalizeText(sourceTrack.artistName);
  const candidateTitle = normalizeText(candidate.name);
  const candidateArtists = normalizeText(candidate.artists.join(" "));

  let score = 0;

  if (candidateTitle === sourceTitle) {
    score += 8;
  } else if (
    candidateTitle.includes(sourceTitle) ||
    sourceTitle.includes(candidateTitle)
  ) {
    score += 5;
  }

  if (candidateArtists === sourceArtist) {
    score += 6;
  } else if (
    candidateArtists.includes(sourceArtist) ||
    sourceArtist.includes(candidateArtists)
  ) {
    score += 4;
  } else {
    const sourceArtistTokens = sourceArtist.split(" ").filter(Boolean);
    const artistOverlap = sourceArtistTokens.filter(
      (token) => token.length > 2 && candidateArtists.includes(token),
    ).length;
    score += Math.min(artistOverlap, 3);
  }

  score += Math.min(Math.round(candidate.popularity / 25), 4);

  return score;
}

async function enrichTracksWithArtwork(
  tracks: TikTokPublicChartTrack[],
): Promise<TikTokPublicChartTrack[]> {
  const enriched = [...tracks];

  for (let index = 0; index < enriched.length; index += 8) {
    const chunk = enriched.slice(index, index + 8);

    await Promise.all(
      chunk.map(async (track) => {
        const cacheKey = `${normalizeText(track.artistName)}::${normalizeText(track.trackName)}`;
        const cachedArtwork = artworkCache.get(cacheKey);

        if (cachedArtwork && cachedArtwork.expiresAt > Date.now()) {
          track.coverUrl = cachedArtwork.coverUrl;
          track.spotifyUrl = cachedArtwork.spotifyUrl;
          return;
        }

        try {
          const results = await searchSpotifyTracks(
            `track:${track.trackName} artist:${track.artistName}`,
            "BR",
            5,
          );
          const bestMatch =
            results
              .map((candidate) => ({
                candidate,
                score: scoreSpotifyMatch(track, candidate),
              }))
              .sort((left, right) => right.score - left.score)[0]?.candidate ??
            null;

          const coverUrl = bestMatch?.coverUrl ?? null;
          const spotifyUrl = bestMatch?.spotifyUrl ?? null;

          track.coverUrl = coverUrl;
          track.spotifyUrl = spotifyUrl;

          artworkCache.set(cacheKey, {
            coverUrl,
            spotifyUrl,
            expiresAt: Date.now() + TIKTOK_PUBLIC_ARTWORK_TTL_MS,
          });
        } catch {
          track.coverUrl = null;
          track.spotifyUrl = null;
        }
      }),
    );
  }

  return enriched;
}

function parseKworbHtml(html: string): TikTokPublicChart {
  const titleMatch = html.match(
    /<title>\s*TikTok Trending Songs - Brazil\s*<\/title>/i,
  );
  const tracks: TikTokPublicChartTrack[] = [];

  if (!titleMatch) {
    throw new Error("Kworb BR chart structure not recognized");
  }

  const rowPattern =
    /<tr><td>(\d+)<\/td><td>([^<]+)<\/td><td class="mp text"><div>([\s\S]*?)<\/div><\/td><\/tr>/gi;
  let rowMatch = rowPattern.exec(html);

  while (rowMatch) {
    const rank = Number(rowMatch[1]);
    const movementLabel = decodeHtmlEntities(rowMatch[2]).trim();
    const entryLabel = decodeHtmlEntities(rowMatch[3])
      .replace(/<[^>]+>/g, "")
      .trim();
    const { artistName, trackName } = splitArtistAndTitle(entryLabel);

    if (
      Number.isFinite(rank) &&
      rank >= 1 &&
      rank <= 200 &&
      trackName &&
      artistName
    ) {
      tracks.push({
        rank,
        movementLabel,
        trackName,
        artistName,
        coverUrl: null,
        spotifyUrl: null,
      });
    }

    rowMatch = rowPattern.exec(html);
  }

  const lines = htmlToLines(html);
  const snapshotDate =
    lines.find((line) => /\b20\d{2}-\d{2}-\d{2}\b/.test(line)) ?? null;

  if (tracks.length === 0) {
    throw new Error("Kworb BR chart returned no tracks");
  }

  return {
    source: "kworb-br",
    snapshotDate,
    tracks,
  };
}

export async function fetchTikTokPublicChart(): Promise<TikTokPublicChart> {
  if (cachedChart && cachedChart.expiresAt > Date.now()) {
    return cachedChart.value;
  }

  if (inFlightChart) {
    return inFlightChart;
  }

  const request = (async () => {
    const response = await fetch("https://kworb.net/charts/tiktok/br.html", {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SoAsBrabaRadar/1.0; +https://system.soasbraba.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`Kworb BR TikTok error ${response.status}`);
    }

    const html = await response.text();
    const parsedChart = parseKworbHtml(html);
    const tracks = await enrichTracksWithArtwork(parsedChart.tracks);
    const chart = {
      ...parsedChart,
      tracks,
    };

    cachedChart = {
      value: chart,
      expiresAt: Date.now() + TIKTOK_PUBLIC_CHART_TTL_MS,
    };

    return chart;
  })();

  inFlightChart = request;

  try {
    return await request;
  } finally {
    inFlightChart = null;
  }
}
