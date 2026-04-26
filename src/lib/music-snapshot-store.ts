import "server-only";

import type { MusicChartSnapshotRecord } from "./charts/movements";

type SupabaseSnapshotResponse = {
  message?: string;
};

type LegacyMusicTrackSnapshotRow = {
  market: string | null;
  genre: string | null;
  track_id: string | null;
  snapshot_date: string | null;
  captured_at: string | null;
  track_name: string | null;
  artists: string | null;
  album_name: string | null;
  cover_url: string | null;
  spotify_url: string | null;
  popularity: number | string | null;
  signal_count: number | string | null;
  source_mode: string | null;
  explicit: boolean | null;
};

type LegacyMusicTrackSnapshotInput = {
  market: string;
  genre: string;
  track_id: string;
  snapshot_date: string;
  captured_at: string;
  track_name: string;
  artists: string;
  album_name: string;
  cover_url: string | null;
  spotify_url: string;
  popularity: number;
  signal_count: number;
  source_mode: string;
  explicit: boolean;
};

export type MusicTrackSnapshotInput = LegacyMusicTrackSnapshotInput;

export type MusicChartSnapshotRow = MusicChartSnapshotRecord & {
  id?: string | null;
};

export type MusicChartSnapshotInput = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  artist_ids: string[];
  album_name: string;
  image_url: string | null;
  spotify_url: string;
  popularity: number;
  rank_position: number;
  source_type: string;
  source_name: string;
  country: string;
  genre: string;
  saturation_count: number;
  snapshot_day: string;
  captured_at: string;
};

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return {
    url,
    anonKey,
  };
}

function buildHeaders(env: { anonKey: string }) {
  return {
    apikey: env.anonKey,
    Authorization: `Bearer ${env.anonKey}`,
  };
}

function parseNumber(value: number | string | null) {
  const parsedValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function mapLegacySnapshotRows(rows: LegacyMusicTrackSnapshotRow[]): MusicChartSnapshotRow[] {
  const rankedByDay = new Map<
    string,
    Array<LegacyMusicTrackSnapshotRow & { track_id: string; snapshot_date: string }>
  >();

  for (const row of rows) {
    if (!row.track_id || !row.snapshot_date) {
      continue;
    }

    const bucket = rankedByDay.get(row.snapshot_date);
    const normalizedRow = row as LegacyMusicTrackSnapshotRow & {
      track_id: string;
      snapshot_date: string;
    };

    if (bucket) {
      bucket.push(normalizedRow);
    } else {
      rankedByDay.set(row.snapshot_date, [normalizedRow]);
    }
  }

  const rankByKey = new Map<string, number>();

  for (const [snapshotDay, bucket] of rankedByDay.entries()) {
    bucket
      .sort((left, right) => {
        const signalDifference =
          parseNumber(right.signal_count) - parseNumber(left.signal_count);

        if (signalDifference !== 0) {
          return signalDifference;
        }

        const popularityDifference =
          parseNumber(right.popularity) - parseNumber(left.popularity);

        if (popularityDifference !== 0) {
          return popularityDifference;
        }

        return (left.track_name ?? "").localeCompare(right.track_name ?? "");
      })
      .forEach((row, index) => {
        rankByKey.set(`${snapshotDay}:${row.track_id}`, index + 1);
      });
  }

  return rows.map((row) => ({
    spotify_track_id: row.track_id,
    track_name: row.track_name,
    artist_name: row.artists,
    artist_ids: [],
    album_name: row.album_name,
    image_url: row.cover_url,
    spotify_url: row.spotify_url,
    popularity: row.popularity,
    rank_position:
      row.snapshot_date && row.track_id
        ? rankByKey.get(`${row.snapshot_date}:${row.track_id}`) ?? null
        : null,
    source_type: row.source_mode,
    source_name: row.source_mode,
    country: row.market,
    genre: row.genre,
    saturation_count: row.signal_count,
    snapshot_day: row.snapshot_date,
    captured_at: row.captured_at,
  }));
}

function toLegacySnapshotInputs(
  rows: MusicChartSnapshotInput[],
): LegacyMusicTrackSnapshotInput[] {
  return rows.map((row) => ({
    market: row.country,
    genre: row.genre,
    track_id: row.spotify_track_id,
    snapshot_date: row.snapshot_day,
    captured_at: row.captured_at,
    track_name: row.track_name,
    artists: row.artist_name,
    album_name: row.album_name,
    cover_url: row.image_url,
    spotify_url: row.spotify_url,
    popularity: row.popularity,
    signal_count: row.saturation_count,
    source_mode: row.source_type,
    explicit: false,
  }));
}

function logSnapshotPersistenceError(message: string) {
  process.stderr.write(`[music_track_snapshots] ${message}\n`);
}

async function postJson({
  env,
  table,
  rows,
  onConflict,
}: {
  env: { url: string; anonKey: string };
  table: string;
  rows: unknown[];
  onConflict: string;
}) {
  const url = new URL(`${env.url}/rest/v1/${table}`);
  url.searchParams.set("on_conflict", onConflict);

  return fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(env),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  }).catch(() => null);
}

async function fetchJson<T>({
  env,
  table,
  searchParams,
}: {
  env: { url: string; anonKey: string };
  table: string;
  searchParams: URLSearchParams;
}) {
  const url = new URL(`${env.url}/rest/v1/${table}`);

  for (const [key, value] of searchParams.entries()) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: buildHeaders(env),
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  return (await response.json().catch(() => null)) as
    | T
    | SupabaseSnapshotResponse
    | null;
}

export async function upsertMusicTrackSnapshots(
  rows: MusicChartSnapshotInput[],
): Promise<boolean> {
  const env = getSupabaseEnv();

  if (!env || rows.length === 0) {
    return false;
  }

  const nextResponse = await postJson({
    env,
    table: "music_chart_snapshots",
    rows,
    onConflict: "country,genre,spotify_track_id,snapshot_day",
  });

  if (nextResponse?.ok) {
    return true;
  }

  const legacyResponse = await postJson({
    env,
    table: "music_track_snapshots",
    rows: toLegacySnapshotInputs(rows),
    onConflict: "market,genre,track_id,snapshot_date",
  });

  return Boolean(legacyResponse?.ok);
}

export async function saveMusicTrackSnapshots(
  rows: MusicTrackSnapshotInput[],
): Promise<boolean> {
  const env = getSupabaseEnv();

  if (!env || rows.length === 0) {
    return false;
  }

  const response = await postJson({
    env,
    table: "music_track_snapshots",
    rows,
    onConflict: "market,genre,track_id,snapshot_date",
  });

  if (response?.ok) {
    return true;
  }

  if (!response) {
    logSnapshotPersistenceError("request failed before receiving a response");
    return false;
  }

  const errorBody = await response.text().catch(() => "");
  const details = errorBody ? ` ${errorBody}` : "";

  logSnapshotPersistenceError(`upsert failed with status ${response.status}.${details}`);

  return false;
}

export async function fetchMusicTrackSnapshots({
  market,
  genre,
  days = 30,
}: {
  market: string;
  genre: string;
  days?: number;
}): Promise<MusicChartSnapshotRow[]> {
  const env = getSupabaseEnv();

  if (!env) {
    return [];
  }

  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - Math.max(days - 1, 0));
  const sinceDay = sinceDate.toISOString().slice(0, 10);

  const nextSearchParams = new URLSearchParams();
  nextSearchParams.set(
    "select",
    "id,spotify_track_id,track_name,artist_name,artist_ids,album_name,image_url,spotify_url,popularity,rank_position,source_type,source_name,country,genre,saturation_count,snapshot_day,captured_at",
  );
  nextSearchParams.set("country", `eq.${market}`);
  nextSearchParams.set("genre", `eq.${genre}`);
  nextSearchParams.set("snapshot_day", `gte.${sinceDay}`);
  nextSearchParams.set("order", "snapshot_day.desc,rank_position.asc,captured_at.desc");

  const nextPayload = await fetchJson<MusicChartSnapshotRow[]>({
    env,
    table: "music_chart_snapshots",
    searchParams: nextSearchParams,
  });

  if (Array.isArray(nextPayload)) {
    return nextPayload;
  }

  const legacySearchParams = new URLSearchParams();
  legacySearchParams.set(
    "select",
    "market,genre,track_id,snapshot_date,captured_at,track_name,artists,album_name,cover_url,spotify_url,popularity,signal_count,source_mode,explicit",
  );
  legacySearchParams.set("market", `eq.${market}`);
  legacySearchParams.set("genre", `eq.${genre}`);
  legacySearchParams.set("snapshot_date", `gte.${sinceDay}`);
  legacySearchParams.set("order", "snapshot_date.desc,captured_at.desc,signal_count.desc");

  const legacyPayload = await fetchJson<LegacyMusicTrackSnapshotRow[]>({
    env,
    table: "music_track_snapshots",
    searchParams: legacySearchParams,
  });

  return Array.isArray(legacyPayload) ? mapLegacySnapshotRows(legacyPayload) : [];
}
