import { NextResponse } from "next/server";
import { createLabelEntity } from "@/lib/label-entities";
import type { LabelEntityInput } from "@/lib/label-entities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LabelEntityInput;

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    }

    if (!body.type) {
      return NextResponse.json({ error: "Tipo é obrigatório." }, { status: 400 });
    }

    const entity = await createLabelEntity(body);
    return NextResponse.json(entity, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
