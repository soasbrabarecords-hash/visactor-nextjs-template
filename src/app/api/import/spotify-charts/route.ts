import { NextResponse } from "next/server";

import {
  importSpotifyChartRows,
  type SpotifyChartImportRow,
} from "@/lib/spotify-charts-importer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportSpotifyChartsBody = {
  rows?: unknown;
};

function isAuthorized(request: Request) {
  const importSecret = process.env.IMPORT_SECRET;
  const headerSecret = request.headers.get("x-import-secret");

  if (!importSecret) {
    return {
      ok: false,
      status: 500,
      message: "IMPORT_SECRET is not configured.",
    } as const;
  }

  if (!headerSecret || headerSecret !== importSecret) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized.",
    } as const;
  }

  return {
    ok: true,
  } as const;
}

export async function POST(request: Request) {
  const authorization = isAuthorized(request);

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status },
    );
  }

  try {
    const body = (await request.json()) as ImportSpotifyChartsBody;

    if (!Array.isArray(body.rows)) {
      return NextResponse.json(
        { message: "Body must include rows: [...] ." },
        { status: 400 },
      );
    }

    const result = await importSpotifyChartRows(
      body.rows as SpotifyChartImportRow[],
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to import Spotify chart rows.";

    return NextResponse.json({ message }, { status: 500 });
  }
}
