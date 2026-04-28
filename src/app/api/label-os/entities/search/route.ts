import { NextResponse } from "next/server";
import { searchLabelEntities } from "@/lib/label-entities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (q.length < 1) {
      return NextResponse.json([]);
    }

    const results = await searchLabelEntities(q);
    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
