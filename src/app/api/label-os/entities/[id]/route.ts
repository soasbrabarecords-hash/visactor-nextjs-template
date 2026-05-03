import { NextResponse } from "next/server";
import type { LabelEntityInput } from "@/lib/label-entities-types";
import { createClient } from "@/lib/supabase/server";

function isMissingColumnError(error: { message?: string } | null | undefined, column: string) {
  return Boolean(
    error?.message?.includes(`Could not find the '${column}' column`) ||
      error?.message?.includes(`column "${column}" does not exist`),
  );
}

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
    let { data, error } = await supabase
      .from("label_entities")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (isMissingColumnError(error, "roles")) {
      const fallbackBody = { ...body };
      delete fallbackBody.roles;

      const retry = await supabase
        .from("label_entities")
        .update(fallbackBody)
        .eq("id", id)
        .select()
        .single();

      data = retry.data;
      error = retry.error;
    }

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
