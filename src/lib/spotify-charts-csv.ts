import "server-only";

import {
  importSpotifyChartRows,
  type SpotifyChartImportRow,
  type SpotifyChartsImportResult,
} from "@/lib/spotify-charts-importer";

type CsvRecord = Record<string, string>;
type CsvImportDefaults = {
  country?: string;
  genre?: string;
  chartDate?: string;
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCell(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(currentValue);
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

function parseCsv(content: string): CsvRecord[] {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record: CsvRecord = {};

    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });

    return record;
  });
}

function getField(
  record: CsvRecord,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = normalizeCell(record[key] ?? "");

    if (value) {
      return value;
    }
  }

  return null;
}

function extractSpotifyTrackId(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (normalized.startsWith("spotify:track:")) {
    return normalized.replace("spotify:track:", "");
  }

  const trackUrlMatch = normalized.match(/spotify\.com\/track\/([A-Za-z0-9]+)/i);

  if (trackUrlMatch?.[1]) {
    return trackUrlMatch[1];
  }

  if (/^[A-Za-z0-9]{22}$/.test(normalized)) {
    return normalized;
  }

  return null;
}

function buildSpotifyUrlFromValue(value: string | null) {
  const trackId = extractSpotifyTrackId(value);

  if (!trackId) {
    return null;
  }

  return `https://open.spotify.com/track/${trackId}`;
}

function normalizeChartDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}

function parseChartDateFromFilename(filename: string) {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return normalizeChartDate(match?.[1]);
}

function mapCsvRowToImportRow(
  record: CsvRecord,
  defaults: CsvImportDefaults,
): SpotifyChartImportRow {
  const trackReference = getField(record, [
    "spotify_track_id",
    "track_id",
    "spotify_id",
    "id",
    "uri",
    "spotify_uri",
    "track_uri",
    "spotify_url",
    "url",
    "track_url",
  ]);
  const spotifyTrackId = extractSpotifyTrackId(trackReference);
  const spotifyUrl =
    getField(record, ["spotify_url", "url", "track_url"]) ??
    buildSpotifyUrlFromValue(trackReference);

  return {
    spotify_track_id: spotifyTrackId,
    track_name: getField(record, ["track_name", "music", "song_name", "name"]),
    artist_name: getField(record, [
      "artist_name",
      "artist",
      "artists",
      "artist_names",
    ]),
    artist_ids: getField(record, ["artist_ids"]),
    album_name: getField(record, ["album_name", "album"]),
    image_url: getField(record, ["image_url", "cover_url", "album_image"]),
    spotify_url: spotifyUrl,
    country:
      getField(record, ["country", "market", "region"]) ??
      defaults.country ??
      null,
    genre: getField(record, ["genre"]) ?? defaults.genre ?? null,
    chart_name: getField(record, ["chart_name", "chart", "chart_type"]) ?? "top-songs",
    source_type: getField(record, ["source_type"]) ?? "spotify_chart",
    chart_date:
      getField(record, ["chart_date", "date", "snapshot_date"]) ??
      defaults.chartDate ??
      new Date().toISOString().slice(0, 10),
    rank_position: getField(record, ["rank_position", "rank", "position"]),
    previous_rank: getField(record, [
      "previous_rank",
      "last_rank",
      "previous_position",
    ]),
    movement_type: getField(record, ["movement_type", "movement"]),
    daily_streams: getField(record, [
      "daily_streams",
      "streams_24h",
      "streams",
    ]),
    captured_at:
      getField(record, ["captured_at", "updated_at"]) ??
      new Date().toISOString(),
  };
}

export async function importSpotifyChartsCsvContent({
  csvText,
  country,
  genre,
  chartDate,
}: {
  csvText: string;
  country?: string;
  genre?: string;
  chartDate?: string;
}): Promise<SpotifyChartsImportResult> {
  const parsedRows = parseCsv(csvText);
  const mappedRows = parsedRows.map((record) =>
    mapCsvRowToImportRow(record, {
      country,
      genre: genre && genre !== "all" ? genre : undefined,
      chartDate: normalizeChartDate(chartDate),
    }),
  );

  return importSpotifyChartRows(mappedRows);
}

export async function importSpotifyChartsCsvFromUrl({
  csvUrl,
  country,
  genre,
  chartDate,
}: {
  csvUrl: string;
  country?: string;
  genre?: string;
  chartDate?: string;
}): Promise<SpotifyChartsImportResult> {
  const response = await fetch(csvUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Nao foi possivel baixar o CSV (${response.status}).`);
  }

  const csvText = await response.text();

  return importSpotifyChartsCsvContent({
    csvText,
    country,
    genre,
    chartDate,
  });
}

export { parseChartDateFromFilename };
