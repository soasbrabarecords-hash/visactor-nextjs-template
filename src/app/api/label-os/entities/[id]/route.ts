import { NextResponse } from "next/server";
import { updateLabelEntity } from "@/lib/label-entities";
import type { LabelEntityInput } from "@/lib/label-entities-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Partial<LabelEntityInput>;

    if (body.name !== undefined && !body.name?.trim()) {
      return NextResponse.json(
        { error: "Nome é obrigatório." },
        { status: 400 },
      );
    }

    const data = await updateLabelEntity(id, body);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
