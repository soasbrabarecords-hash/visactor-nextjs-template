import { NextResponse } from "next/server";
import { createArtistOsRecord, getArtistOsResource } from "@/lib/artist-os";
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource: rawResource } = await params;
    const resource = parseResource(rawResource);

    if (!resource) {
      return NextResponse.json({ error: "Recurso ArtistOS invalido." }, { status: 404 });
    }

    const data = await getArtistOsResource(resource);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource: rawResource } = await params;
    const resource = parseResource(rawResource);
    const config = resource ? getArtistOsResourceConfig(resource) : null;

    if (!resource || !config) {
      return NextResponse.json({ error: "Recurso ArtistOS invalido." }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const missingField = config.fields.find(
      (field) => field.required && !String(body[field.key] ?? "").trim(),
    );

    if (missingField) {
      return NextResponse.json(
        { error: `${missingField.label} e obrigatorio.` },
        { status: 400 },
      );
    }

    const row = await createArtistOsRecord(resource, body);
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

