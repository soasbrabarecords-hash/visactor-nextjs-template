import { NextResponse } from "next/server";
import { getMusicChartsData } from "@/lib/music-charts-data";
import {
  importSpotifyChartRows,
  type SpotifyChartImportRow,
} from "@/lib/spotify-charts-importer";

type RefreshRequestBody = {
  country?: string;
  genre?: string;
};

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

async function importSpotifyChartsCsv({
  csvUrl,
  country,
  genre,
}: {
  csvUrl: string;
  country?: string;
  genre?: string;
}) {
  const response = await fetch(csvUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Nao foi possivel baixar o CSV (${response.status}).`);
  }

  const csvText = await response.text();
  const parsedRows = parseCsv(csvText);
  const mappedRows = parsedRows.map((record) =>
    mapCsvRowToImportRow(record, {
      country,
      genre: genre && genre !== "all" ? genre : undefined,
    }),
  );

  return importSpotifyChartRows(mappedRows);
}

export async function POST(request: Request) {
  const updatedAt = new Date().toISOString();
  let body: RefreshRequestBody = {};

  try {
    body = (await request.json()) as RefreshRequestBody;
  } catch {
    body = {};
  }

  const csvUrl = process.env.SPOTIFY_CHARTS_CSV_URL;

  try {
    let importedCount = 0;
    let skippedCount = 0;
    let errors: string[] = [];
    let message =
      "CSV URL nao configurada; radar reprocessado sem streams.";
    let importSucceeded = true;

    if (csvUrl) {
      try {
        const importResult = await importSpotifyChartsCsv({
          csvUrl,
          country: body.country,
          genre: body.genre,
        });

        importedCount = importResult.insertedCount;
        skippedCount = importResult.skippedCount;
        errors = importResult.errors;
        message =
          importedCount > 0
            ? `CSV importado com ${importedCount} linhas validas antes do refresh do radar.`
            : "CSV processado sem novas linhas validas; radar reprocessado com base atual.";
      } catch (error) {
        importSucceeded = false;
        errors = [
          error instanceof Error
            ? error.message
            : "Falha ao importar o CSV de streams.",
        ];
        message =
          "Falha ao importar o CSV; radar reprocessado com os dados atuais disponiveis.";
      }
    }

    const data = await getMusicChartsData({
      country: body.country,
      genre: body.genre,
    });

    const refreshMessage =
      data.workbenchTracks.length > 0
        ? ` Radar atualizado com ${data.workbenchTracks.length} faixas processadas.`
        : " Radar atualizado, mas sem faixas ativas neste recorte.";

    return NextResponse.json({
      success: importSucceeded,
      importedCount,
      skippedCount,
      errors,
      message: `${message}${refreshMessage}`,
      updatedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel atualizar o radar agora.";

    return NextResponse.json(
      {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errors: [message],
        message,
        updatedAt,
      },
      {
        status: 500,
      },
    );
  }
}
