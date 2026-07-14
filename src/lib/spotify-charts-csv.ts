import "server-only";
import {
  type SpotifyTrackRecord,
  fetchSpotifyTracksByIds,
} from "@/lib/spotify";
import {
  type SpotifyChartImportRow,
  type SpotifyChartsImportResult,
  importSpotifyChartRows,
} from "@/lib/spotify-charts-importer";
import { fetchSpotifyOEmbedCoverUrls } from "@/lib/spotify-cover-images";

type CsvRecord = Record<string, string>;
type CsvImportDefaults = {
  country?: string;
  genre?: string;
  chartDate?: string;
  chartType?: string;
  sourceType?: string;
};

export type SpotifyChartCsvInspectionIssue = {
  code: string;
  message: string;
};

export type SpotifyChartCsvInspection = {
  valid: boolean;
  parsedRows: number;
  validRows: number;
  uniqueRanks: number;
  minRank: number | null;
  maxRank: number | null;
  duplicateRanks: number;
  completeTop200: boolean;
  missingRequiredFields: Array<{ field: string; count: number }>;
  dateEvidencePresent: boolean;
  dateMatchesRequest: boolean;
  errors: SpotifyChartCsvInspectionIssue[];
};

const EXPECTED_TOP_CHART_ROWS = 200;

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

function getField(record: CsvRecord, keys: string[]): string | null {
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

  const trackUrlMatch = normalized.match(
    /spotify\.com\/track\/([A-Za-z0-9]+)/i,
  );

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
    "spotify_track_uri",
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
    spotify_track_uri:
      getField(record, [
        "spotify_track_uri",
        "spotify_uri",
        "track_uri",
        "uri",
      ]) ?? (spotifyTrackId ? `spotify:track:${spotifyTrackId}` : null),
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
    chart_name:
      getField(record, ["chart_name", "chart", "chart_type"]) ??
      defaults.chartType ??
      "top-songs",
    source_type:
      getField(record, ["source_type"]) ??
      defaults.sourceType ??
      "spotify_chart",
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

export function inspectSpotifyChartsCsvContent({
  csvText,
  country,
  chartDate,
  chartType = "top-songs",
  sourceType = "spotify_chart",
}: {
  csvText: string;
  country: string;
  chartDate: string;
  chartType?: string;
  sourceType?: string;
}): SpotifyChartCsvInspection {
  const records = parseCsv(csvText);
  const rows = records.map((record) =>
    mapCsvRowToImportRow(record, {
      country,
      chartDate,
      chartType,
      sourceType,
    }),
  );
  const missingCounts = new Map<string, number>();
  const ranks: number[] = [];
  let validRows = 0;
  let dateEvidencePresent = records.length > 0;
  let dateMatchesRequest = records.length > 0;

  for (const [index, row] of rows.entries()) {
    const providerDate = getField(records[index], [
      "chart_date",
      "date",
      "snapshot_date",
    ]);
    const required = [
      ["spotify_track_id", row.spotify_track_id],
      ["track_name", row.track_name],
      ["artist_name", row.artist_name],
      ["rank_position", row.rank_position],
    ] as const;
    let rowValid = true;

    for (const [field, value] of required) {
      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
      ) {
        missingCounts.set(field, (missingCounts.get(field) ?? 0) + 1);
        rowValid = false;
      }
    }

    const rank = Number(row.rank_position);
    if (
      !Number.isFinite(rank) ||
      !Number.isInteger(rank) ||
      rank < 1 ||
      rank > EXPECTED_TOP_CHART_ROWS
    ) {
      rowValid = false;
    } else {
      ranks.push(rank);
    }

    const normalizedDate = normalizeChartDate(providerDate ?? undefined);
    if (!providerDate || !normalizedDate) {
      dateEvidencePresent = false;
      dateMatchesRequest = false;
      rowValid = false;
    }

    if (normalizedDate !== chartDate) {
      dateMatchesRequest = false;
      rowValid = false;
    }

    if (rowValid) validRows += 1;
  }

  const uniqueRanks = new Set(ranks);
  const duplicateRanks = ranks.length - uniqueRanks.size;
  const completeTop200 =
    records.length === EXPECTED_TOP_CHART_ROWS &&
    ranks.length === EXPECTED_TOP_CHART_ROWS &&
    uniqueRanks.size === EXPECTED_TOP_CHART_ROWS &&
    Array.from(
      { length: EXPECTED_TOP_CHART_ROWS },
      (_value, index) => index + 1,
    ).every((rank) => uniqueRanks.has(rank));
  const missingRequiredFields = Array.from(missingCounts, ([field, count]) => ({
    field,
    count,
  }));
  const errors: SpotifyChartCsvInspectionIssue[] = [];

  if (!completeTop200) {
    errors.push({
      code: "incomplete_top_200",
      message: `A fonte precisa retornar o Top 200 completo, com ranks continuos de 1 a 200; foram recebidas ${records.length} linhas e ${uniqueRanks.size} ranks unicos validos.`,
    });
  }

  if (validRows !== records.length) {
    errors.push({
      code: "invalid_rows",
      message: `${records.length - validRows} linhas nao passaram na validacao.`,
    });
  }

  if (duplicateRanks > 0) {
    errors.push({
      code: "duplicate_ranks",
      message: `${duplicateRanks} posicoes de ranking estao duplicadas.`,
    });
  }

  if (!dateEvidencePresent) {
    errors.push({
      code: "missing_date_evidence",
      message:
        "A fonte nao informou a data do snapshot em chart_date, date ou snapshot_date.",
    });
  }

  if (dateEvidencePresent && !dateMatchesRequest) {
    errors.push({
      code: "date_mismatch",
      message: `A fonte nao corresponde integralmente a ${chartDate}.`,
    });
  }

  return {
    valid: errors.length === 0,
    parsedRows: records.length,
    validRows,
    uniqueRanks: uniqueRanks.size,
    minRank: ranks.length > 0 ? Math.min(...ranks) : null,
    maxRank: ranks.length > 0 ? Math.max(...ranks) : null,
    duplicateRanks,
    completeTop200,
    missingRequiredFields,
    dateEvidencePresent,
    dateMatchesRequest,
    errors,
  };
}

function buildTrackRecordMap(tracks: SpotifyTrackRecord[]) {
  return new Map(tracks.map((track) => [track.id, track] as const));
}

async function enrichRowsWithSpotifyMetadata(
  rows: SpotifyChartImportRow[],
  market = "BR",
) {
  const trackIds = rows
    .map((row) => row.spotify_track_id?.trim() ?? "")
    .filter((trackId) => trackId.length > 0);

  if (trackIds.length === 0) {
    return rows;
  }

  let enrichedRows = rows;

  try {
    const normalizedMarket = market.trim().toUpperCase();
    const spotifyMarket = /^[A-Z]{2}$/.test(normalizedMarket)
      ? normalizedMarket
      : "US";
    const spotifyTracks = await fetchSpotifyTracksByIds(
      trackIds,
      spotifyMarket,
    );
    const tracksById = buildTrackRecordMap(spotifyTracks);

    enrichedRows = rows.map((row) => {
      const trackId = row.spotify_track_id?.trim() ?? "";
      const spotifyTrack = tracksById.get(trackId);

      if (!spotifyTrack) {
        return row;
      }

      return {
        ...row,
        track_name: spotifyTrack.name || row.track_name,
        artist_name: spotifyTrack.artists.join(", ") || row.artist_name,
        artist_ids:
          spotifyTrack.artistIds.length > 0
            ? spotifyTrack.artistIds
            : row.artist_ids,
        album_name: spotifyTrack.albumName || row.album_name,
        image_url: spotifyTrack.coverUrl ?? row.image_url ?? null,
        spotify_url: spotifyTrack.spotifyUrl || row.spotify_url,
      };
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Spotify metadata error.";
    process.stderr.write(
      `Failed to enrich spotify chart rows with Spotify metadata: ${message}\n`,
    );
  }

  const missingCoverTrackIds = enrichedRows
    .filter((row) => !row.image_url)
    .map((row) => row.spotify_track_id?.trim() ?? "")
    .filter((trackId) => trackId.length > 0);
  const fallbackCovers = await fetchSpotifyOEmbedCoverUrls(
    missingCoverTrackIds,
  ).catch(() => new Map<string, string>());

  return enrichedRows.map((row) => {
    const trackId = row.spotify_track_id?.trim() ?? "";

    return {
      ...row,
      image_url: row.image_url ?? fallbackCovers.get(trackId) ?? null,
    };
  });
}

export async function importSpotifyChartsCsvContent({
  csvText,
  country,
  metadataMarket,
  genre,
  chartDate,
  chartType,
  sourceType,
  enrichSpotifyMetadata = true,
  persistStreamSnapshots = true,
  persistLegacyEntries = true,
  persistSnapshotAtomically = false,
}: {
  csvText: string;
  country?: string;
  metadataMarket?: string;
  genre?: string;
  chartDate?: string;
  chartType?: string;
  sourceType?: string;
  enrichSpotifyMetadata?: boolean;
  persistStreamSnapshots?: boolean;
  persistLegacyEntries?: boolean;
  persistSnapshotAtomically?: boolean;
}): Promise<SpotifyChartsImportResult> {
  const parsedRows = parseCsv(csvText);
  const mappedRows = parsedRows.map((record) =>
    mapCsvRowToImportRow(record, {
      country,
      genre: genre && genre !== "all" ? genre : undefined,
      chartDate: normalizeChartDate(chartDate),
      chartType,
      sourceType,
    }),
  );
  const enrichedRows = enrichSpotifyMetadata
    ? await enrichRowsWithSpotifyMetadata(
        mappedRows,
        metadataMarket ?? country ?? "BR",
      )
    : mappedRows;

  return importSpotifyChartRows(enrichedRows, {
    persistStreamSnapshots,
    persistLegacyEntries,
    persistSnapshotAtomically,
  });
}

export async function importSpotifyChartsCsvFromUrl({
  csvUrl,
  country,
  genre,
  chartDate,
  chartType,
}: {
  csvUrl: string;
  country?: string;
  genre?: string;
  chartDate?: string;
  chartType?: string;
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
    chartType,
  });
}

export { parseChartDateFromFilename };
