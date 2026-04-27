import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type KworbTrackData = {
  trackId: string;
  dailyStreams: number | null;
  totalStreams: number | null;
  lastDate: string | null;
  trend: "up" | "down" | "same" | null;
  dailyDelta: number | null;
};

// Cache simples em memória — TTL de 24h por track
const cache = new Map<string, { data: KworbTrackData; expiresAt: number }>();

function parseNumber(str: string): number | null {
  const cleaned = str.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

function parseDelta(str: string): { value: number | null; trend: "up" | "down" | "same" | null } {
  const trimmed = str.trim();
  if (!trimmed || trimmed === "0" || trimmed === "-") return { value: 0, trend: "same" };
  const isNeg = trimmed.startsWith("-");
  const cleaned = trimmed.replace(/[^\d]/g, "");
  if (!cleaned) return { value: null, trend: null };
  const n = parseInt(cleaned, 10);
  return {
    value: isNeg ? -n : n,
    trend: isNeg ? "down" : n > 0 ? "up" : "same",
  };
}

function parseKworbHtml(html: string, trackId: string): KworbTrackData {
  // A tabela do Kworb tem thead com Date | Streams | +/- | Total
  // Pega as linhas do tbody
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    return { trackId, dailyStreams: null, totalStreams: null, lastDate: null, trend: null, dailyDelta: null };
  }

  const rows = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  // Filtra só linhas de dados (não thead)
  const dataRows = rows.filter((r) => !/<th/i.test(r[1]));

  if (dataRows.length === 0) {
    return { trackId, dailyStreams: null, totalStreams: null, lastDate: null, trend: null, dailyDelta: null };
  }

  // Primeira linha = mais recente
  const firstRow = dataRows[0][1];
  const cells = [...firstRow.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim(),
  );

  if (cells.length < 3) {
    return { trackId, dailyStreams: null, totalStreams: null, lastDate: null, trend: null, dailyDelta: null };
  }

  const lastDate = cells[0] ?? null;
  const dailyStreams = parseNumber(cells[1] ?? "");
  const deltaResult = parseDelta(cells[2] ?? "");
  const totalStreams = cells[3] ? parseNumber(cells[3]) : null;

  return {
    trackId,
    dailyStreams,
    totalStreams,
    lastDate,
    trend: deltaResult.trend,
    dailyDelta: deltaResult.value,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;

  if (!trackId || !/^[a-zA-Z0-9]+$/.test(trackId)) {
    return NextResponse.json({ message: "trackId inválido." }, { status: 400 });
  }

  const now = Date.now();
  const cached = cache.get(trackId);

  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data);
  }

  try {
    const url = `https://kworb.net/spotify/track/${trackId}.html`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        Referer: "https://kworb.net/",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const empty: KworbTrackData = {
        trackId,
        dailyStreams: null,
        totalStreams: null,
        lastDate: null,
        trend: null,
        dailyDelta: null,
      };
      // Cache negativo por 1h pra não bater sempre
      cache.set(trackId, { data: empty, expiresAt: now + 60 * 60 * 1000 });
      return NextResponse.json(empty);
    }

    const html = await response.text();
    const data = parseKworbHtml(html, trackId);

    // Cache positivo por 24h
    cache.set(trackId, { data, expiresAt: now + 24 * 60 * 60 * 1000 });

    return NextResponse.json(data);
  } catch (error) {
    const empty: KworbTrackData = {
      trackId,
      dailyStreams: null,
      totalStreams: null,
      lastDate: null,
      trend: null,
      dailyDelta: null,
    };
    return NextResponse.json(empty);
  }
}
