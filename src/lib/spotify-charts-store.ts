import "server-only";

type SupabaseResponse = {
  message?: string;
};

export type SpotifyChartEntryRow = {
  id?: string | null;
  spotify_track_id: string | null;
  track_name: string | null;
  artist_name: string | null;
  artist_ids: string[] | null;
  album_name: string | null;
  image_url: string | null;
  spotify_url: string | null;
  country: string | null;
  genre: string | null;
  chart_name: string | null;
  source_type: string | null;
  chart_date: string | null;
  rank_position: number | string | null;
  previous_rank: number | string | null;
  movement_type: string | null;
  daily_streams: number | string | null;
  captured_at: string | null;
};

export type SpotifyChartEntryInput = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  artist_ids: string[];
  album_name: string;
  image_url: string | null;
  spotify_url: string;
  country: string;
  genre: string | null;
  chart_name: string;
  source_type: string;
  chart_date: string;
  rank_position: number;
  previous_rank: number | null;
  movement_type: string | null;
  daily_streams: number | null;
  captured_at: string;
};

export type TrackStreamSnapshotRow = {
  id?: string | null;
  spotify_track_id: string | null;
  track_name: string | null;
  artist_name: string | null;
  artist_ids: string[] | null;
  album_name: string | null;
  image_url: string | null;
  spotify_url: string | null;
  country: string | null;
  genre: string | null;
  chart_name: string | null;
  chart_date: string | null;
  daily_streams: number | string | null;
  rank_position: number | string | null;
  previous_rank: number | string | null;
  captured_at: string | null;
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

async function fetchJson<T>(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  return (await response.json().catch(() => null)) as T | SupabaseResponse | null;
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

export async function fetchSpotifyChartEntries({
  country,
  genre,
  chartDate,
  chartName,
  limit = 200,
}: {
  country?: string;
  genre?: string;
  chartDate?: string;
  chartName?: string;
  limit?: number;
} = {}): Promise<SpotifyChartEntryRow[]> {
  const env = getSupabaseEnv();

  if (!env) {
    return [];
  }

  const url = new URL(`${env.url}/rest/v1/spotify_chart_entries`);
  url.searchParams.set(
    "select",
    "id,spotify_track_id,track_name,artist_name,artist_ids,album_name,image_url,spotify_url,country,genre,chart_name,source_type,chart_date,rank_position,previous_rank,movement_type,daily_streams,captured_at",
  );

  if (country) {
    url.searchParams.set("country", `eq.${country}`);
  }

  if (genre) {
    url.searchParams.set("genre", `eq.${genre}`);
  }

  if (chartDate) {
    url.searchParams.set("chart_date", `eq.${chartDate}`);
  }

  if (chartName) {
    url.searchParams.set("chart_name", `eq.${chartName}`);
  }

  url.searchParams.set("order", "chart_date.desc,rank_position.asc,captured_at.desc");
  url.searchParams.set("limit", String(limit));

  const payload = await fetchJson<SpotifyChartEntryRow[]>(
    url.toString(),
    buildHeaders(env),
  );

  return Array.isArray(payload) ? payload : [];
}

export async function upsertSpotifyChartEntries(
  rows: SpotifyChartEntryInput[],
): Promise<boolean> {
  const env = getSupabaseEnv();

  if (!env || rows.length === 0) {
    return false;
  }

  const response = await postJson({
    env,
    table: "spotify_chart_entries",
    rows,
    onConflict: "country,chart_name,chart_date,spotify_track_id",
  });

  return Boolean(response?.ok);
}

export async function fetchLatestSpotifyChartEntries({
  country,
  genre,
  chartName,
  limit = 200,
}: {
  country?: string;
  genre?: string;
  chartName?: string;
  limit?: number;
} = {}): Promise<SpotifyChartEntryRow[]> {
  const latestRows = await fetchSpotifyChartEntries({
    country,
    genre,
    chartName,
    limit: 1,
  });
  const latestChartDate = latestRows[0]?.chart_date;

  if (!latestChartDate) {
    return [];
  }

  return fetchSpotifyChartEntries({
    country,
    genre,
    chartName,
    chartDate: latestChartDate,
    limit,
  });
}

// ── Adapter: chart_snapshot_tracks → SpotifyChartEntryRow[] ──────────────────
//
// Lê de chart_snapshot_tracks (histórico diário persistido) em vez de
// spotify_chart_entries. Retorna exatamente o mesmo shape que a UI espera,
// sem alterar nenhuma prop ou componente.

type ChartSnapshotTrackRaw = {
  id: string;
  snapshot_id: string;
  chart_date: string;
  position: number;
  previous_position: number | null;
  spotify_track_id: string | null;
  track_name: string;
  artist_name: string | null;
  streams: number | null;
  kworb_streams_24h: number | null;
  genre: string | null;
  image_url: string | null;
  created_at: string;
};

function snapshotTrackToEntryRow(
  row: ChartSnapshotTrackRaw,
  country: string,
): SpotifyChartEntryRow {
  const trackId = row.spotify_track_id?.trim() ?? null;
  return {
    id: row.id,
    spotify_track_id: trackId,
    track_name: row.track_name,
    artist_name: row.artist_name,
    // Campos parcialmente presentes na nova tabela
    artist_ids: null,
    album_name: null,
    image_url: row.image_url?.trim() || null,
    spotify_url: trackId
      ? `https://open.spotify.com/track/${trackId}`
      : null,
    country,
    genre: row.genre,
    chart_name: "top-songs",
    source_type: "spotify_charts_csv",
    chart_date: row.chart_date,
    rank_position: row.position,
    previous_rank: row.previous_position,
    movement_type: null,
    daily_streams: row.streams,
    captured_at: row.created_at,
  };
}

export async function fetchLatestFromSnapshotTracks({
  country = "BR",
  genre,
  limit = 200,
}: {
  country?: string;
  genre?: string;
  limit?: number;
} = {}): Promise<SpotifyChartEntryRow[]> {
  const env = getSupabaseEnv();
  if (!env) return [];

  // 1. Pegar a data mais recente disponível em chart_snapshots para o country
  const snapshotUrl = new URL(`${env.url}/rest/v1/chart_snapshots`);
  snapshotUrl.searchParams.set("select", "chart_date");
  snapshotUrl.searchParams.set("country", `eq.${country}`);
  snapshotUrl.searchParams.set("order", "chart_date.desc");
  snapshotUrl.searchParams.set("limit", "1");

  const snapshotPayload = await fetchJson<{ chart_date: string }[]>(
    snapshotUrl.toString(),
    buildHeaders(env),
  );

  const latestDate = Array.isArray(snapshotPayload)
    ? snapshotPayload[0]?.chart_date
    : null;

  if (!latestDate) {
    // Sem snapshots — fallback para spotify_chart_entries
    return fetchLatestSpotifyChartEntries({ country, genre, limit });
  }

  // 2. Buscar as tracks do snapshot mais recente
  const tracksUrl = new URL(`${env.url}/rest/v1/chart_snapshot_tracks`);
  tracksUrl.searchParams.set(
    "select",
    "id,snapshot_id,chart_date,position,previous_position,spotify_track_id,track_name,artist_name,streams,kworb_streams_24h,genre,image_url,created_at",
  );
  tracksUrl.searchParams.set("chart_date", `eq.${latestDate}`);
  tracksUrl.searchParams.set("order", "position.asc");
  tracksUrl.searchParams.set("limit", String(limit));

  if (genre && genre !== "all") {
    tracksUrl.searchParams.set("genre", `eq.${genre}`);
  }

  const tracksPayload = await fetchJson<ChartSnapshotTrackRaw[]>(
    tracksUrl.toString(),
    buildHeaders(env),
  );

  if (!Array.isArray(tracksPayload) || tracksPayload.length === 0) {
    // Snapshot existe mas tracks vazias — fallback
    return fetchLatestSpotifyChartEntries({ country, genre, limit });
  }

  return tracksPayload.map((row) => snapshotTrackToEntryRow(row, country));
}

export async function fetchTrackStreamSnapshots({
  trackIds,
  country,
  chartName,
  sinceDate,
  limit = 500,
}: {
  trackIds?: string[];
  country?: string;
  chartName?: string;
  sinceDate?: string;
  limit?: number;
} = {}): Promise<TrackStreamSnapshotRow[]> {
  const env = getSupabaseEnv();

  if (!env) {
    return [];
  }

  const url = new URL(`${env.url}/rest/v1/track_stream_snapshots`);
  url.searchParams.set(
    "select",
    "id,spotify_track_id,track_name,artist_name,artist_ids,album_name,image_url,spotify_url,country,genre,chart_name,chart_date,daily_streams,rank_position,previous_rank,captured_at",
  );

  if (trackIds && trackIds.length > 0) {
    const encodedIds = trackIds.join(",");
    url.searchParams.set("spotify_track_id", `in.(${encodedIds})`);
  }

  if (country) {
    url.searchParams.set("country", `eq.${country}`);
  }

  if (chartName) {
    url.searchParams.set("chart_name", `eq.${chartName}`);
  }

  if (sinceDate) {
    url.searchParams.set("chart_date", `gte.${sinceDate}`);
  }

  url.searchParams.set("order", "chart_date.desc,rank_position.asc,captured_at.desc");
  url.searchParams.set("limit", String(limit));

  const payload = await fetchJson<TrackStreamSnapshotRow[]>(
    url.toString(),
    buildHeaders(env),
  );

  return Array.isArray(payload) ? payload : [];
}
