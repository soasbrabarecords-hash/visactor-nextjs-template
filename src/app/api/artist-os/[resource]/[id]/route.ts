import { NextResponse } from "next/server";
import { deleteArtistOsRecord, updateArtistOsRecord } from "@/lib/artist-os";
import {
  artistOsResources,
  getArtistOsResourceConfig,
  type ArtistOsResourceKey,
} from "@/lib/artist-os-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseResource(resource: string): ArtistOsResourceKey | null {
  return resource in artistOsResources ? (resource as ArtistOsResourceKey) : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const { resource: rawResource, id } = await params;
    const resource = parseResource(rawResource);
    const config = resource ? getArtistOsResourceConfig(resource) : null;

    if (!resource || !config) {
      return NextResponse.json({ error: "Recurso Business OS invalido." }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const missingField = config.fields.find(
      (field) =>
        field.required &&
        body[field.key] !== undefined &&
        !String(body[field.key] ?? "").trim(),
    );

    if (missingField) {
      return NextResponse.json(
        { error: `${missingField.label} e obrigatorio.` },
        { status: 400 },
      );
    }

    const row = await updateArtistOsRecord(resource, id, body);
    return NextResponse.json(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const { resource: rawResource, id } = await params;
    const resource = parseResource(rawResource);

    if (!resource) {
      return NextResponse.json({ error: "Recurso Business OS invalido." }, { status: 404 });
    }

    const result = await deleteArtistOsRecord(resource, id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
