import { NextResponse } from "next/server";
import { getLabelEntityById, createLabelEntity } from "@/lib/label-entities";
import type { LabelEntityInput } from "@/lib/label-entities-types";
import { createClient } from "@/lib/supabase/server";

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
      return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("label_entities")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
