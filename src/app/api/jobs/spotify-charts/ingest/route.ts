import { NextResponse } from "next/server";
import { importSpotifyChartCsv } from "@/lib/charts/import-spotify-chart-csv";
import {
  finishSpotifyChartRun,
  startSpotifyChartRun,
} from "@/lib/charts/spotify-chart-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AutomaticChart = {
  chartType: string;
  country: string;
  csvUrlTemplate: string | null;
  fallbackUrl: string;
};

function getAutomaticCharts(): AutomaticChart[] {
  return [
    {
      chartType: "top-songs",
      country: "BR",
      csvUrlTemplate:
        process.env.SPOTIFY_CHARTS_BR_CSV_URL_TEMPLATE?.trim() || null,
      fallbackUrl: "https://kworb.net/spotify/country/br_daily.html",
    },
    {
      chartType: "top-songs",
      country: "GLOBAL",
      csvUrlTemplate:
        process.env.SPOTIFY_CHARTS_GLOBAL_CSV_URL_TEMPLATE?.trim() || null,
      fallbackUrl: "https://kworb.net/spotify/country/global_daily.html",
    },
  ];
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCandidateDates() {
  const today = new Date();

  return [0, 1, 2].map((daysAgo) => {
    const candidate = new Date(today);
    candidate.setUTCDate(candidate.getUTCDate() - daysAgo);
    return formatUtcDate(candidate);
  });
}

function buildSourceUrl(template: string, chartDate: string) {
  return template.replaceAll("{date}", chartDate);
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code)),
    );
}

function stripHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function parseInteger(value: string) {
  const normalized = value.replace(/[^\d-]/g, "");
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function convertKworbHtmlToCsv(html: string) {
  const dateMatch = html.match(
    /Spotify Daily Chart[^<]*-\s*(\d{4})\/(\d{2})\/(\d{2})/i,
  );
  const chartDate = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    : null;
  const tableMatch = html.match(
    /<table[^>]*id=["']spotifydaily["'][^>]*>([\s\S]*?)<\/table>/i,
  );

  if (!chartDate || !tableMatch) {
    throw new Error(
      "O espelho do Spotify Charts nao retornou data/tabela valida.",
    );
  }

  const csvRows = [
    [
      "rank",
      "previous_rank",
      "track_name",
      "artist_names",
      "spotify_track_uri",
      "streams",
    ]
      .map(csvCell)
      .join(","),
  ];

  for (const rowMatch of tableMatch[1].matchAll(
    /<tr[^>]*>([\s\S]*?)<\/tr>/gi,
  )) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 7) continue;

    const rank = parseInteger(stripHtml(cells[0][1]));
    const movement = stripHtml(cells[1][1]);
    const titleCell = cells[2][1];
    const trackMatch = titleCell.match(
      /href=["'][^"']*\/track\/([A-Za-z0-9]+)\.html["'][^>]*>([\s\S]*?)<\/a>/i,
    );

    if (!rank || !trackMatch) continue;

    const artistNames = Array.from(
      titleCell.matchAll(
        /href=["'][^"']*\/artist\/[A-Za-z0-9]+\.html["'][^>]*>([\s\S]*?)<\/a>/gi,
      ),
      (match) => stripHtml(match[1]),
    ).filter(Boolean);
    const movementAmount = parseInteger(movement);
    const previousRank =
      movement === "="
        ? rank
        : movement.startsWith("+") && movementAmount !== null
          ? rank + movementAmount
          : movement.startsWith("-") && movementAmount !== null
            ? Math.max(1, rank - Math.abs(movementAmount))
            : null;
    const streams = parseInteger(stripHtml(cells[6][1]));

    csvRows.push(
      [
        rank,
        previousRank,
        stripHtml(trackMatch[2]),
        Array.from(new Set(artistNames)).join(", "),
        `spotify:track:${trackMatch[1]}`,
        streams,
      ]
        .map(csvCell)
        .join(","),
    );

    if (csvRows.length > 200) break;
  }

  if (csvRows.length === 1) {
    throw new Error("O espelho do Spotify Charts nao retornou faixas validas.");
  }

  return { chartDate, csvText: csvRows.join("\n") };
}

async function downloadMirrorChart(chart: AutomaticChart) {
  const response = await fetch(chart.fallbackUrl, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "MusicBusinessOS-SpotifyCharts/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Espelho do Spotify Charts retornou HTTP ${response.status}.`,
    );
  }

  const converted = convertKworbHtmlToCsv(await response.text());

  if (!getCandidateDates().includes(converted.chartDate)) {
    throw new Error(
      `Ultimo chart do espelho (${converted.chartDate}) nao corresponde a hoje, ontem ou anteontem.`,
    );
  }

  return {
    ...converted,
    sourceUrl: chart.fallbackUrl,
  };
}

async function downloadLatestAvailableChart(chart: AutomaticChart) {
  const attempts: string[] = [];

  if (chart.csvUrlTemplate) {
    for (const chartDate of getCandidateDates()) {
      const sourceUrl = buildSourceUrl(chart.csvUrlTemplate, chartDate);
      const response = await fetch(sourceUrl, {
        cache: "no-store",
        headers: {
          Accept: "text/csv,text/plain;q=0.9,*/*;q=0.1",
          "User-Agent": "MusicBusinessOS-SpotifyCharts/1.0",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        attempts.push(`${chartDate}: HTTP ${response.status}`);
        continue;
      }

      const csvText = await response.text();
      const normalizedStart = csvText.trimStart().slice(0, 100).toLowerCase();

      if (
        csvText.trim().length === 0 ||
        normalizedStart.startsWith("<!doctype html") ||
        normalizedStart.startsWith("<html")
      ) {
        attempts.push(`${chartDate}: resposta nao e CSV`);
        continue;
      }

      return {
        chartDate,
        sourceUrl,
        csvText,
      };
    }
  }

  try {
    return await downloadMirrorChart(chart);
  } catch (error) {
    const mirrorError =
      error instanceof Error ? error.message : "falha desconhecida no espelho";
    throw new Error(
      `Nenhum chart disponivel para hoje, ontem ou anteontem (${[
        ...attempts,
        mirrorError,
      ].join("; ")}).`,
    );
  }
}

async function ingestChart(chart: AutomaticChart) {
  const initialDate = getCandidateDates()[0];
  let runId: string | null = null;
  let attemptedDate = initialDate;
  let attemptedSourceUrl: string | null = null;

  try {
    runId = await startSpotifyChartRun({
      chartType: chart.chartType,
      country: chart.country,
      chartDate: initialDate,
    });
    const downloaded = await downloadLatestAvailableChart(chart);
    attemptedDate = downloaded.chartDate;
    attemptedSourceUrl = downloaded.sourceUrl;
    const result = await importSpotifyChartCsv({
      csvText: downloaded.csvText,
      chartType: chart.chartType,
      country: chart.country,
      chartDate: downloaded.chartDate,
      sourceUrl: downloaded.sourceUrl,
      enrichSpotifyMetadata: false,
    });

    if (result.rows_count === 0) {
      throw new Error(
        result.errors[0] ??
          "CSV encontrado, mas nenhuma linha valida foi importada.",
      );
    }

    if (!result.debug?.entriesSaved || !result.debug.snapshotCreated) {
      throw new Error(
        result.errors[0] ??
          "O CSV foi parseado, mas o snapshot nao foi persistido no Supabase.",
      );
    }

    await finishSpotifyChartRun(runId, {
      status: "success",
      chartDate: downloaded.chartDate,
      sourceUrl: downloaded.sourceUrl,
      rowsCount: result.rows_count,
    });

    return {
      success: true,
      chartType: chart.chartType,
      country: chart.country,
      chartDate: downloaded.chartDate,
      rowsCount: result.rows_count,
      skippedCount: result.skippedCount,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido na ingestao.";

    if (runId) {
      await finishSpotifyChartRun(runId, {
        status: "error",
        chartDate: attemptedDate,
        sourceUrl: attemptedSourceUrl,
        rowsCount: 0,
        errorMessage: message,
      }).catch(() => undefined);
    }

    return {
      success: false,
      chartType: chart.chartType,
      country: chart.country,
      chartDate: attemptedDate,
      rowsCount: 0,
      error: message,
    };
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const results = [];

  for (const chart of getAutomaticCharts()) {
    results.push(await ingestChart(chart));
  }

  return NextResponse.json({
    success: results.every((result) => result.success),
    results,
  });
}
