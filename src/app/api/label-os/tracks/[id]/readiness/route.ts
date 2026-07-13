import { NextResponse } from "next/server";
import { upsertTrackReadiness } from "@/lib/label-readiness-server";
import {
  EMPTY_TRACK_READINESS,
  type LabelTrackReadinessInput,
  type ReadinessPriority,
} from "@/lib/label-readiness-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIORITIES = new Set<ReadinessPriority>([
  "low",
  "medium",
  "high",
  "urgent",
]);

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseInput(body: Record<string, unknown>): LabelTrackReadinessInput {
  const commission =
    body.label_commission_percentage === null ||
    body.label_commission_percentage === ""
      ? null
      : Number(body.label_commission_percentage);
  if (
    commission !== null &&
    (!Number.isFinite(commission) || commission < 0 || commission > 100)
  ) {
    throw new Error("A comissão do selo precisa estar entre 0% e 100%.");
  }

  const priority = PRIORITIES.has(body.priority as ReadinessPriority)
    ? (body.priority as ReadinessPriority)
    : EMPTY_TRACK_READINESS.priority;

  return {
    work_registered: body.work_registered === true,
    work_registration_society: optionalText(body.work_registration_society),
    work_registration_proof_attached:
      body.work_registration_proof_attached === true,
    p_line: optionalText(body.p_line),
    c_line: optionalText(body.c_line),
    master_owner: optionalText(body.master_owner),
    wav_approved: body.wav_approved === true,
    cover_approved: body.cover_approved === true,
    distributor: optionalText(body.distributor),
    label_commission_percentage: commission,
    payment_data_confirmed: body.payment_data_confirmed === true,
    contracts_approved: body.contracts_approved === true,
    featured_contract_approved: body.featured_contract_approved === true,
    payment_rule: optionalText(body.payment_rule),
    symphonic_release_created: body.symphonic_release_created === true,
    delivered_to_stores: body.delivered_to_stores === true,
    published: body.published === true,
    responsible: optionalText(body.responsible),
    priority,
    notes: optionalText(body.notes),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const readiness = await upsertTrackReadiness(id, parseInput(body));
    return NextResponse.json(readiness);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
