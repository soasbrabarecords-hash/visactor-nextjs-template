import { NextResponse } from "next/server";
import { createLabelTrack } from "@/lib/label-os";
import type { LabelTrackInput } from "@/lib/label-os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LabelTrackInput;

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });
    }

    const track = await createLabelTrack(body);
    return NextResponse.json(track, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
