import { NextResponse } from "next/server";
import { updateLabelTrack } from "@/lib/label-os";
import type { LabelTrackInput } from "@/lib/label-os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Partial<LabelTrackInput>;

    if (body.title !== undefined && !body.title?.trim()) {
      return NextResponse.json({ error: "Titulo e obrigatorio." }, { status: 400 });
    }

    const track = await updateLabelTrack(id, body);
    return NextResponse.json(track);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
