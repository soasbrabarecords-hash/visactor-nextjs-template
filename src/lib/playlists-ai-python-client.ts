import "server-only";
import type { PlaylistOsAccessRole } from "@/lib/playlist-os-read-access";
import type { PlaylistsAiFeedbackAction } from "@/types/playlists-ai";

export type PlaylistsAiPythonFailureReason =
  | "not_configured"
  | "timeout"
  | "network_error"
  | "upstream_error"
  | "invalid_response";

export type PlaylistsAiPythonRankCandidate = {
  track_id: string;
  name: string;
  artists: string;
  market: "BR" | "GLOBAL";
  current_position: number;
  positions: Partial<Record<"BR" | "GLOBAL", number>>;
  movement_7d: number | null;
  opportunity_score: number;
  heat_score: number;
  momentum_score: number;
  freshness_score: number;
  stability_score: number;
  saturation_risk: number;
  crossover_score: number;
  genre: string | null;
  genre_confidence: number | null;
  playlist_fit: number;
  observed_days_30: number;
  is_new_entry: boolean;
  baseline_fit_score: number;
  baseline_score: number;
};

export type PlaylistsAiPythonRankRequest = {
  workspace_id: string;
  playlist_id: string;
  playlist_name: string;
  genre: string | null;
  market: "BR" | "GLOBAL" | "BOTH";
  as_of: string;
  limit: number;
  candidates: PlaylistsAiPythonRankCandidate[];
};

export type PlaylistsAiPythonRankItem = {
  track_id: string;
  rank: number;
  score: number;
  base_score: number | null;
  learned_score: number | null;
  reason_codes: string[];
  propensity: number | null;
};

export type PlaylistsAiPythonRankResponse = {
  request_id: string;
  model_version: string;
  personalized: boolean;
  cold_start: boolean;
  items: PlaylistsAiPythonRankItem[];
};

export type PlaylistsAiPythonFeedbackRequest = {
  workspace_id: string;
  request_id: string;
  track_id: string;
  action: PlaylistsAiFeedbackAction;
  target_playlist_id: string | null;
  actor_id: string;
  actor_role: PlaylistOsAccessRole;
  event_id: string;
  occurred_at: string;
};

type PythonClientFailure = {
  ok: false;
  reason: PlaylistsAiPythonFailureReason;
};

export type PlaylistsAiPythonRankResult =
  { ok: true; value: PlaylistsAiPythonRankResponse } | PythonClientFailure;

export type PlaylistsAiPythonOperationResult =
  { ok: true; value: unknown } | PythonClientFailure;

type PythonClientConfig = {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  maintenanceTimeoutMs?: number;
};

type PythonClientOptions = {
  fetcher?: typeof fetch;
  config?: PythonClientConfig | null;
};

const DEFAULT_TIMEOUT_MS = 2_500;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_MAINTENANCE_TIMEOUT_MS = 55_000;
const MIN_MAINTENANCE_TIMEOUT_MS = 1_000;
const MAX_MAINTENANCE_TIMEOUT_MS = 58_000;
const reportedFailures = new Set<string>();

function configuredTimeout(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return DEFAULT_TIMEOUT_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.min(Number(value), MAX_TIMEOUT_MS));
}

function configuredMaintenanceTimeout(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return DEFAULT_MAINTENANCE_TIMEOUT_MS;
  return Math.max(
    MIN_MAINTENANCE_TIMEOUT_MS,
    Math.min(Number(value), MAX_MAINTENANCE_TIMEOUT_MS),
  );
}

function getPythonClientConfig(): PythonClientConfig | null {
  const rawUrl = process.env.PLAYLISTS_AI_PYTHON_URL?.trim() ?? "";
  const token = process.env.PLAYLISTS_AI_PYTHON_TOKEN?.trim() ?? "";
  if (!rawUrl || !token) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return {
      baseUrl: url.toString().replace(/\/+$/, ""),
      token,
      timeoutMs: configuredTimeout(process.env.PLAYLISTS_AI_PYTHON_TIMEOUT_MS),
      maintenanceTimeoutMs: configuredMaintenanceTimeout(
        process.env.PLAYLISTS_AI_PYTHON_MAINTENANCE_TIMEOUT_MS,
      ),
    };
  } catch {
    return null;
  }
}

function reportFailureOnce(
  operation: "rank" | "feedback" | "maintenance",
  reason: PlaylistsAiPythonFailureReason,
  status?: number,
) {
  const key = `${operation}:${reason}:${status ?? ""}`;
  if (reportedFailures.has(key)) return;
  reportedFailures.add(key);
  process.stderr.write(
    `[playlists-ai:python] ${operation} fallback (${reason}${status ? `, status=${status}` : ""})\n`,
  );
}

async function postToPython(
  path: string,
  body: unknown,
  operation: "rank" | "feedback" | "maintenance",
  options: PythonClientOptions = {},
): Promise<PlaylistsAiPythonOperationResult> {
  const config =
    options.config === undefined ? getPythonClientConfig() : options.config;
  if (!config) {
    reportFailureOnce(operation, "not_configured");
    return { ok: false, reason: "not_configured" };
  }

  const controller = new AbortController();
  const timeoutMs =
    operation === "maintenance"
      ? (config.maintenanceTimeoutMs ?? DEFAULT_MAINTENANCE_TIMEOUT_MS)
      : config.timeoutMs;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetcher ?? fetch)(
      `${config.baseUrl}${path}`,
      {
        method: "POST",
        headers: {
          "X-Playlists-AI-Token": config.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      reportFailureOnce(operation, "upstream_error", response.status);
      return { ok: false, reason: "upstream_error" };
    }

    const payload = await response.json().catch(() => undefined);
    if (payload === undefined) {
      if (operation !== "rank") return { ok: true, value: null };
      reportFailureOnce(operation, "invalid_response");
      return { ok: false, reason: "invalid_response" };
    }
    return { ok: true, value: payload };
  } catch (error) {
    const reason: PlaylistsAiPythonFailureReason =
      controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError")
        ? "timeout"
        : "network_error";
    reportFailureOnce(operation, reason);
    return { ok: false, reason };
  } finally {
    clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown, maxLength = 200) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function optionalScore(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
    ? value
    : null;
}

function optionalProbability(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}

function parseRankResponse(
  value: unknown,
  candidateIds: ReadonlySet<string>,
): PlaylistsAiPythonRankResponse | null {
  if (!isRecord(value)) return null;
  const requestId = requiredString(value.request_id);
  const modelVersion = requiredString(value.model_version);
  if (
    !requestId ||
    !modelVersion ||
    typeof value.personalized !== "boolean" ||
    typeof value.cold_start !== "boolean" ||
    !Array.isArray(value.items) ||
    value.items.length > candidateIds.size
  ) {
    return null;
  }

  const seen = new Set<string>();
  const seenRanks = new Set<number>();
  const items: PlaylistsAiPythonRankItem[] = [];
  for (const rawItem of value.items) {
    if (!isRecord(rawItem)) return null;
    const trackId = requiredString(rawItem.track_id);
    const score = optionalScore(rawItem.score);
    if (
      !trackId ||
      !candidateIds.has(trackId) ||
      seen.has(trackId) ||
      score === null
    ) {
      return null;
    }
    const rank = rawItem.rank;
    if (
      typeof rank !== "number" ||
      !Number.isInteger(rank) ||
      rank < 1 ||
      rank > value.items.length ||
      seenRanks.has(rank)
    ) {
      return null;
    }
    const reasonCodes = Array.isArray(rawItem.reason_codes)
      ? rawItem.reason_codes
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];
    seen.add(trackId);
    seenRanks.add(rank);
    items.push({
      track_id: trackId,
      rank,
      score,
      base_score: optionalScore(rawItem.base_score),
      learned_score: optionalScore(rawItem.learned_score),
      reason_codes: reasonCodes,
      propensity: optionalProbability(rawItem.propensity),
    });
  }

  for (let expectedRank = 1; expectedRank <= items.length; expectedRank += 1) {
    if (!seenRanks.has(expectedRank)) return null;
  }

  return {
    request_id: requestId,
    model_version: modelVersion,
    personalized: value.personalized,
    cold_start: value.cold_start,
    items: items.sort((left, right) => left.rank - right.rank),
  };
}

export async function rankPlaylistCandidates(
  input: PlaylistsAiPythonRankRequest,
  options: PythonClientOptions = {},
): Promise<PlaylistsAiPythonRankResult> {
  const result = await postToPython("/v1/rank", input, "rank", options);
  if (!result.ok) return result;

  const parsed = parseRankResponse(
    result.value,
    new Set(input.candidates.map((candidate) => candidate.track_id)),
  );
  if (!parsed) {
    reportFailureOnce("rank", "invalid_response");
    return { ok: false, reason: "invalid_response" };
  }
  return { ok: true, value: parsed };
}

export async function sendPlaylistAiFeedback(
  input: PlaylistsAiPythonFeedbackRequest,
  options: PythonClientOptions = {},
) {
  return postToPython("/v1/feedback", input, "feedback", options);
}

export async function runPlaylistAiMaintenance(
  options: PythonClientOptions = {},
) {
  return postToPython("/v1/maintenance/run", {}, "maintenance", options);
}
