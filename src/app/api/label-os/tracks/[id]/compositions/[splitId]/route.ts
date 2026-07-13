import { NextResponse } from "next/server";
import {
  deleteTrackComposition,
  updateTrackComposition,
} from "@/lib/label-splits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string; splitId: string }>;
};

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id: trackId, splitId } = await params;
    const body = (await request.json()) as {
      role?: string;
      percentage?: number;
    };
    const result = await updateTrackComposition(trackId, splitId, {
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
    await deleteTrackComposition(trackId, splitId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
