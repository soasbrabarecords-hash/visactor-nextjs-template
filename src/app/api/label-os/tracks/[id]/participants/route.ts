import { NextResponse } from "next/server";
import { addTrackParticipant } from "@/lib/label-os";
import type { TrackParticipantInput } from "@/lib/label-os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: trackId } = await params;
    const body = (await request.json()) as Omit<TrackParticipantInput, "track_id">;

    if (!body.artist_id) {
      return NextResponse.json({ error: "Artista é obrigatório." }, { status: 400 });
    }
    if (!body.role) {
      return NextResponse.json({ error: "Role é obrigatório." }, { status: 400 });
    }

    const participant = await addTrackParticipant({ ...body, track_id: trackId });
    return NextResponse.json(participant, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
