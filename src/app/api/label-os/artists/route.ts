import { NextResponse } from "next/server";
import { createLabelArtist } from "@/lib/label-os";
import type { LabelArtistInput } from "@/lib/label-os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LabelArtistInput;

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
    }

    const artist = await createLabelArtist(body);
    return NextResponse.json(artist, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
