import "server-only";

export type TikTokPublicChartTrack = {
  rank: number;
  trackName: string;
  artistName: string;
};

export type TikTokPublicChart = {
  source: "tikcharts";
  snapshotDate: string | null;
  tracks: TikTokPublicChartTrack[];
};

type CacheEntry = {
  value: TikTokPublicChart;
  expiresAt: number;
};

const TIKTOK_PUBLIC_CHART_TTL_MS = 30 * 60 * 1000;

let cachedChart: CacheEntry | null = null;
let inFlightChart: Promise<TikTokPublicChart> | null = null;

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

function parseTikChartsHtml(html: string): TikTokPublicChart {
  const lines = htmlToLines(html);
  const markerIndex = lines.findIndex((line) =>
    /Viral Charts Top 100/i.test(line),
  );
  const relevantLines = markerIndex >= 0 ? lines.slice(markerIndex) : lines;
  const combinedText = relevantLines.join(" ");
  const snapshotDate =
    combinedText.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1] ?? null;
  const tracks: TikTokPublicChartTrack[] = [];

  for (let index = 0; index < relevantLines.length; index += 1) {
    const currentLine = relevantLines[index];

    if (!/^\d{1,3}$/.test(currentLine)) {
      continue;
    }

    const rank = Number(currentLine);

    if (!Number.isFinite(rank) || rank < 1 || rank > 100) {
      continue;
    }

    let cursor = index + 1;

    while (
      cursor < relevantLines.length &&
      /^(Image|Top 100|TikTok|Weekly Rankings|latest|Select)$/i.test(
        relevantLines[cursor],
      )
    ) {
      cursor += 1;
    }

    const trackName = relevantLines[cursor];
    const artistName = relevantLines[cursor + 1];

    if (
      !trackName ||
      !artistName ||
      /^\d{1,3}$/.test(trackName) ||
      /^\d{1,3}$/.test(artistName)
    ) {
      continue;
    }

    if (!tracks.some((track) => track.rank === rank)) {
      tracks.push({
        rank,
        trackName,
        artistName,
      });
    }
  }

  return {
    source: "tikcharts",
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
    const response = await fetch("https://tikcharts.com/", {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SoAsBrabaRadar/1.0; +https://system.soasbraba.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`TikCharts error ${response.status}`);
    }

    const html = await response.text();
    const chart = parseTikChartsHtml(html);

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
