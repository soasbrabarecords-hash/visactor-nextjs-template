import { NextResponse } from "next/server";
import { getSnapshotWithComparison } from "@/lib/chart-snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const country = searchParams.get("country") ?? "BR";

    if (!date) {
      return NextResponse.json(
        { error: "Parâmetro 'date' é obrigatório (YYYY-MM-DD)." },
        { status: 400 },
      );
    }

    const result = await getSnapshotWithComparison(date, country);

    if (!result.snapshot) {
      return NextResponse.json(
        { error: `Nenhum snapshot encontrado para ${date}.` },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
