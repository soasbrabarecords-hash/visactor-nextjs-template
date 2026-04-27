import "server-only";

import {
  importSpotifyChartRows,
  type SpotifyChartImportRow,
  type SpotifyChartsImportResult,
} from "@/lib/spotify-charts-importer";

type CsvRecord = Record<string, string>;

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

function mapCsvRowToImportRow(
  record: CsvRecord,
  defaults: {
    country?: string;
    genre?: string;
  },
): SpotifyChartImportRow {
  return {
    spotify_track_id: getField(record, [
      "spotify_track_id",
      "track_id",
      "spotify_id",
      "id",
    ]),
    track_name: getField(record, ["track_name", "music", "song_name", "name"]),
    artist_name: getField(record, ["artist_name", "artist", "artists"]),
    artist_ids: getField(record, ["artist_ids"]),
    album_name: getField(record, ["album_name", "album"]),
    image_url: getField(record, ["image_url", "cover_url", "album_image"]),
    spotify_url: getField(record, ["spotify_url", "url", "track_url"]),
    country: getField(record, ["country", "market"]) ?? defaults.country ?? null,
    genre: getField(record, ["genre"]) ?? defaults.genre ?? null,
    chart_name: getField(record, ["chart_name", "source_name"]) ?? "top-songs",
    source_type:
      getField(record, ["source_type", "source"]) ?? "spotify_chart",
    chart_date:
      getField(record, ["chart_date", "date", "snapshot_date"]) ??
      new Date().toISOString().slice(0, 10),
    rank_position: getField(record, ["rank_position", "rank", "position"]),
    previous_rank: getField(record, ["previous_rank", "last_rank"]),
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
}: {
  csvText: string;
  country?: string;
  genre?: string;
}): Promise<SpotifyChartsImportResult> {
  const parsedRows = parseCsv(csvText);
  const mappedRows = parsedRows.map((record) =>
    mapCsvRowToImportRow(record, {
      country,
      genre: genre && genre !== "all" ? genre : undefined,
    }),
  );

  return importSpotifyChartRows(mappedRows);
}

export async function importSpotifyChartsCsvFromUrl({
  csvUrl,
  country,
  genre,
}: {
  csvUrl: string;
  country?: string;
  genre?: string;
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
  });
}
