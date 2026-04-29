import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type BrDailyEntry = {
  rank: number;
  trackId: string;
  trackName: string;
  artist: string;
  dailyStreams: number | null;
  totalStreams: number | null;
};

export type BrDailyResponse = {
  date: string | null;
  entries: BrDailyEntry[];
};

function parseNumber(str: string): number | null {
  const cleaned = str.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Kworb BR Daily page: https://kworb.net/spotify/country/br_daily.html
 * Table columns: Pos | Artist and Title | Streams | +/- | Total Streams
 * Track links look like: <a href="/spotify/track/TRACKID.html">
 */
function parseBrDailyHtml(html: string): BrDailyResponse {
  // Extract date from page (usually in <p> or <h2> near top)
  const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : null;

  const entries: BrDailyEntry[] = [];

  // Find rows in the main table
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return { date, entries };

  const rowMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1];
    // Skip header rows
    if (/<th/i.test(rowHtml)) continue;

    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 3) continue;

    // Cell 0: rank (position)
    const rankText = cells[0][1].replace(/<[^>]+>/g, "").trim();
    const rank = parseInt(rankText, 10);
    if (!Number.isFinite(rank)) continue;

    // Cell 1: artist and title with link to track
    const cell1Html = cells[1][1];
    const trackLinkMatch = cell1Html.match(/\/spotify\/track\/([a-zA-Z0-9]+)\.html/);
    if (!trackLinkMatch) continue;
    const trackId = trackLinkMatch[1];

    // Parse artist and title from the cell text
    // Kworb format: "Artist - Title" or split across spans
    const cellText = cell1Html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    // Try splitting on " - " to get artist / title
    const dashIdx = cellText.indexOf(" - ");
    let artist = "";
    let trackName = cellText;
    if (dashIdx > 0) {
      artist = cellText.slice(0, dashIdx).trim();
      trackName = cellText.slice(dashIdx + 3).trim();
    }

    // Cell 2: daily streams
    const dailyStreams = parseNumber(cells[2][1].replace(/<[^>]+>/g, "").trim());

    // Cell 4: total streams (if present)
    const totalStreams = cells[4]
      ? parseNumber(cells[4][1].replace(/<[^>]+>/g, "").trim())
      : null;

    entries.push({ rank, trackId, trackName, artist, dailyStreams, totalStreams });

    if (entries.length >= 200) break;
  }

  return { date, entries };
}

export async function GET() {
  const now = Date.now();
  const globalCache = (globalThis as Record<string, unknown>)._kworbBrDailyCache as
    | { data: BrDailyResponse; expiresAt: number }
    | undefined;

  if (globalCache && globalCache.expiresAt > now) {
    return NextResponse.json(globalCache.data);
  }

  try {
    const url = "https://kworb.net/spotify/country/br_daily.html";
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        Referer: "https://kworb.net/",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return NextResponse.json({ date: null, entries: [] });
    }

    const html = await response.text();
    const data = parseBrDailyHtml(html);

    // Cache for 6 hours
    (globalThis as Record<string, unknown>)._kworbBrDailyCache = {
      data,
      expiresAt: now + 6 * 60 * 60 * 1000,
    };

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ date: null, entries: [] });
  }
}
