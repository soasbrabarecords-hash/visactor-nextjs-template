import { NextResponse } from "next/server";
import { addTrackRoyaltySplit } from "@/lib/label-splits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: trackId } = await params;
    const body = (await request.json()) as {
      entity_id?: string;
      role?: string;
      percentage?: number;
      recoupable?: boolean;
      notes?: string;
    };

    if (!body.entity_id) {
      return NextResponse.json(
        { error: "entity_id é obrigatório." },
        { status: 400 },
      );
    }
    if (body.percentage === undefined || body.percentage === null) {
      return NextResponse.json(
        { error: "percentage é obrigatório." },
        { status: 400 },
      );
    }

    const result = await addTrackRoyaltySplit({
      track_id: trackId,
      entity_id: body.entity_id,
      role: body.role,
      percentage: body.percentage,
      recoupable: body.recoupable ?? false,
      notes: body.notes,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
