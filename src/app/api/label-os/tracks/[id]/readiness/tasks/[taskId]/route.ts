import { NextResponse } from "next/server";
import { deleteTrackTask, updateTrackTask } from "@/lib/label-readiness-server";
import type {
  LabelTrackTaskInput,
  ReadinessPriority,
  ReadinessTaskStatus,
} from "@/lib/label-readiness-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set<ReadinessTaskStatus>(["todo", "in_progress", "done"]);
const PRIORITIES = new Set<ReadinessPriority>([
  "low",
  "medium",
  "high",
  "urgent",
]);

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    const { id, taskId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const input: Partial<LabelTrackTaskInput> = {};

    if (body.title !== undefined) {
      const title = optionalText(body.title);
      if (!title) {
        return NextResponse.json(
          { error: "O título da tarefa é obrigatório." },
          { status: 400 },
        );
      }
      input.title = title;
    }
    if (STATUSES.has(body.status as ReadinessTaskStatus)) {
      input.status = body.status as ReadinessTaskStatus;
    }
    if (PRIORITIES.has(body.priority as ReadinessPriority)) {
      input.priority = body.priority as ReadinessPriority;
    }
    if (body.responsible !== undefined)
      input.responsible = optionalText(body.responsible);
    if (body.due_date !== undefined)
      input.due_date = optionalText(body.due_date);
    if (body.notes !== undefined) input.notes = optionalText(body.notes);

    const task = await updateTrackTask(id, taskId, input);
    return NextResponse.json(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    const { id, taskId } = await params;
    await deleteTrackTask(id, taskId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
