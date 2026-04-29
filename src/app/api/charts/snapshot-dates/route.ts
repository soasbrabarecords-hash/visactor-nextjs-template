import { NextResponse } from "next/server";
import { getSnapshotDates } from "@/lib/chart-snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country") ?? "BR";

    const dates = await getSnapshotDates(country);
    return NextResponse.json({ dates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
