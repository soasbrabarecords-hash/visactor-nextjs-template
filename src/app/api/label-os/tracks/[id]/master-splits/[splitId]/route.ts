import { NextResponse } from "next/server";
import {
  deleteTrackMasterSplit,
  updateTrackMasterSplit,
} from "@/lib/label-splits";
import type { MasterGroupType } from "@/lib/label-splits-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_GROUPS = new Set<MasterGroupType>([
  "interpreter",
  "phonographic_producer",
  "musician",
]);

type Context = {
  params: Promise<{ id: string; splitId: string }>;
};

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id: trackId, splitId } = await params;
    const body = (await request.json()) as {
      group_type?: MasterGroupType;
      role?: string;
      percentage?: number;
    };
    if (body.group_type && !VALID_GROUPS.has(body.group_type)) {
      return NextResponse.json({ error: "Grupo inválido." }, { status: 400 });
    }
    const result = await updateTrackMasterSplit(trackId, splitId, {
      ...(body.group_type ? { group_type: body.group_type } : {}),
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.percentage !== undefined
        ? { percentage: body.percentage }
        : {}),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id: trackId, splitId } = await params;
    await deleteTrackMasterSplit(trackId, splitId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
