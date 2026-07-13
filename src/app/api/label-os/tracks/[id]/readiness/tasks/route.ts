import { NextResponse } from "next/server";
import { createTrackTask } from "@/lib/label-readiness-server";
import {
  type LabelTrackTaskInput,
  READINESS_AREAS,
  type ReadinessAreaKey,
  type ReadinessPriority,
} from "@/lib/label-readiness-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AREA_SET = new Set<ReadinessAreaKey>(READINESS_AREAS);
const PRIORITIES = new Set<ReadinessPriority>([
  "low",
  "medium",
  "high",
  "urgent",
]);

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const title = optionalText(body.title);
    if (!title) {
      return NextResponse.json(
        { error: "O título da tarefa é obrigatório." },
        { status: 400 },
      );
    }

    const input: LabelTrackTaskInput = {
      title,
      area: AREA_SET.has(body.area as ReadinessAreaKey)
        ? (body.area as ReadinessAreaKey)
        : "track",
      responsible: optionalText(body.responsible),
      priority: PRIORITIES.has(body.priority as ReadinessPriority)
        ? (body.priority as ReadinessPriority)
        : "medium",
      status: "todo",
      due_date: optionalText(body.due_date),
      notes: optionalText(body.notes),
    };

    const task = await createTrackTask(id, input);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
