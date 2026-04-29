import { NextResponse } from "next/server";
import { addTrackMasterSplit } from "@/lib/label-splits";
import type { MasterGroupType } from "@/lib/label-splits-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_GROUP_TYPES: MasterGroupType[] = [
  "interpreter",
  "phonographic_producer",
  "musician",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: trackId } = await params;
    const body = (await request.json()) as {
      entity_id?: string;
      group_type?: string;
      role?: string;
      percentage?: number;
    };

    if (!body.entity_id) {
      return NextResponse.json(
        { error: "entity_id é obrigatório." },
        { status: 400 },
      );
    }
    if (!body.group_type || !VALID_GROUP_TYPES.includes(body.group_type as MasterGroupType)) {
      return NextResponse.json(
        { error: "group_type inválido. Use: interpreter, phonographic_producer ou musician." },
        { status: 400 },
      );
    }
    if (body.percentage === undefined || body.percentage === null) {
      return NextResponse.json(
        { error: "percentage é obrigatório." },
        { status: 400 },
      );
    }

    const result = await addTrackMasterSplit({
      track_id: trackId,
      entity_id: body.entity_id,
      group_type: body.group_type as MasterGroupType,
      role: body.role,
      percentage: body.percentage,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
