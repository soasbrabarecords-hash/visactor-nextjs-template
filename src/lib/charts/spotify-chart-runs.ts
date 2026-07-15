import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SpotifyChartRun = {
  id: string;
  chart_type: string;
  country: string;
  chart_date: string;
  source_url: string | null;
  source_type: string | null;
  status: string;
  rows_count: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  resolved_by_complete_snapshot: boolean;
};

export async function startSpotifyChartRun(input: {
  chartType: string;
  country: string;
  chartDate: string;
  sourceUrl?: string | null;
  sourceType?: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for Spotify Charts ingestion.",
    );
  }

  const { data, error } = await admin
    .from("spotify_chart_runs")
    .insert({
      chart_type: input.chartType,
      country: input.country,
      chart_date: input.chartDate,
      source_url: input.sourceUrl ?? null,
      source_type: input.sourceType ?? null,
      status: "running",
      rows_count: 0,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Nao foi possivel iniciar spotify_chart_runs: ${error?.message ?? "id ausente"}`,
    );
  }

  return data.id as string;
}

export async function finishSpotifyChartRun(
  runId: string,
  input: {
    status: "success" | "error";
    chartDate: string;
    sourceUrl?: string | null;
    sourceType?: string | null;
    rowsCount?: number;
    errorMessage?: string | null;
  },
) {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for Spotify Charts ingestion.",
    );
  }

  const { error } = await admin
    .from("spotify_chart_runs")
    .update({
      chart_date: input.chartDate,
      source_url: input.sourceUrl ?? null,
      source_type: input.sourceType ?? null,
      status: input.status,
      rows_count: input.rowsCount ?? 0,
      error_message: input.errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    throw new Error(
      `Nao foi possivel finalizar spotify_chart_runs: ${error.message}`,
    );
  }
}

export async function getLatestSpotifyChartRun(country?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("spotify_chart_runs")
    .select(
      "id,chart_type,country,chart_date,source_url,source_type,status,rows_count,error_message,started_at,finished_at",
    )
    .order("started_at", { ascending: false })
    .limit(1);

  if (country) {
    query = query.eq("country", country.trim().toUpperCase());
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) return null;

  const run = data as Omit<SpotifyChartRun, "resolved_by_complete_snapshot">;

  if (run.status !== "error") {
    return { ...run, resolved_by_complete_snapshot: false };
  }

  const { data: completeSnapshot, error: snapshotError } = await supabase
    .from("spotify_chart_complete_snapshots")
    .select("snapshot_id")
    .eq("country", run.country)
    .eq("chart_type", run.chart_type)
    .eq("chart_date", run.chart_date)
    .limit(1)
    .maybeSingle();

  return {
    ...run,
    resolved_by_complete_snapshot: !snapshotError && Boolean(completeSnapshot),
  };
}
