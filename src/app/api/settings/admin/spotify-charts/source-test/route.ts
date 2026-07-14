import { NextResponse } from "next/server";
import { authorizeSpotifyChartsAdminRequest } from "@/lib/charts/spotify-chart-admin-auth";
import { SpotifyChartSourceDownloadError } from "@/lib/charts/spotify-chart-source";
import {
  SpotifyChartSourceValidationError,
  summarizeSpotifyChartHistoricalProbe,
  testSpotifyChartHistoricalSource,
} from "@/lib/charts/spotify-chart-source-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SourceTestBody = {
  regionId?: unknown;
  chartType?: unknown;
  date?: unknown;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function normalizeRequest(body: SourceTestBody) {
  const regionId =
    typeof body.regionId === "string" ? body.regionId.trim().toUpperCase() : "";
  const chartType =
    typeof body.chartType === "string"
      ? body.chartType.trim().toLowerCase()
      : "top-songs";
  const date = typeof body.date === "string" ? body.date.trim() : "";

  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(regionId)) {
    throw new Error("regionId deve usar uma chave regional valida.");
  }

  if (chartType !== "top-songs") {
    throw new Error("Somente chartType top-songs esta habilitado.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("date deve usar o formato YYYY-MM-DD.");
  }

  return { regionId, chartType, date };
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const checkedAt = new Date().toISOString();

  try {
    const authorization = await authorizeSpotifyChartsAdminRequest(request);

    if (!authorization.authorized) {
      return json(
        {
          success: false,
          requestId,
          checkedAt,
          error: authorization.error,
        },
        authorization.status,
      );
    }

    const body = normalizeRequest((await request.json()) as SourceTestBody);
    const result = await testSpotifyChartHistoricalSource(body);

    return json({ requestId, ...result }, result.success ? 200 : 502);
  } catch (error) {
    if (error instanceof SpotifyChartSourceValidationError) {
      const summary = summarizeSpotifyChartHistoricalProbe(error.probe);

      return json(
        {
          success: false,
          requestId,
          checkedAt,
          ...summary,
          snapshotGenerated: false,
          snapshot: {
            generated: false,
            persisted: false,
            id: null,
            totalTracks: 0,
            source: null,
            ingestionError: null,
          },
          errors: [
            error.message,
            ...error.probe.inspection.errors.map((item) => item.message),
          ],
          sideEffects: {
            queueTouched: false,
            campaignTouched: false,
            snapshotPersisted: false,
          },
        },
        422,
      );
    }

    if (error instanceof SpotifyChartSourceDownloadError) {
      const primaryAttempt = error.attempts[0] ?? null;

      return json(
        {
          success: false,
          requestId,
          checkedAt,
          error: "source_unavailable",
          source: primaryAttempt
            ? {
                configured: true,
                provider: primaryAttempt.provider,
                url: primaryAttempt.url,
              }
            : { configured: false },
          response: {
            received: primaryAttempt?.responseReceived ?? false,
            httpStatus: primaryAttempt?.httpStatus ?? null,
          },
          parser: { working: false },
          snapshotGenerated: false,
          snapshot: { generated: false, persisted: false },
          attempts: error.attempts,
          errors: error.attempts.map((attempt) => attempt.error),
          sideEffects: {
            queueTouched: false,
            campaignTouched: false,
            snapshotPersisted: false,
          },
        },
        503,
      );
    }

    const message =
      error instanceof Error ? error.message : "Falha desconhecida na fonte.";
    const isBadRequest =
      /regionId|chartType|date deve|date nao pode|data valida|nao encontrada no catalogo/.test(
        message,
      );

    return json(
      {
        success: false,
        requestId,
        checkedAt,
        error: isBadRequest ? "invalid_request" : "source_unavailable",
        message,
        snapshotGenerated: false,
        snapshot: { generated: false, persisted: false },
        errors: [message],
        sideEffects: {
          queueTouched: false,
          campaignTouched: false,
          snapshotPersisted: false,
        },
      },
      isBadRequest ? 400 : 503,
    );
  }
}
