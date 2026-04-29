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

    // Exige pelo menos entity_id ou artist_id
    if (!body.entity_id && !body.artist_id) {
      return NextResponse.json(
        { error: "É necessário informar um participante (entity_id ou artist_id)." },
        { status: 400 },
      );
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
