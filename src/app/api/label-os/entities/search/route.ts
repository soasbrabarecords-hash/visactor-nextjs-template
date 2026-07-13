import { NextResponse } from "next/server";
import { searchLabelEntities } from "@/lib/label-entities";
import {
  ENTITY_FUNCTION_OPTIONS,
  type EntityFunction,
} from "@/lib/label-os-taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const validRoles = new Set<string>(
      ENTITY_FUNCTION_OPTIONS.map((option) => option.value),
    );
    const roles = (searchParams.get("roles") ?? "")
      .split(",")
      .map((role) => role.trim())
      .filter((role): role is EntityFunction => validRoles.has(role));

    if (q.length < 1) {
      return NextResponse.json([]);
    }

    const results = await searchLabelEntities(q, roles);
    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
