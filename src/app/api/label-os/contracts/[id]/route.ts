import { NextResponse } from "next/server";
import {
  LABEL_CONTRACT_STATUSES,
  type LabelContractStatus,
} from "@/lib/label-contract-types";
import { updateLabelContractStatus } from "@/lib/label-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { status?: string };
    if (!LABEL_CONTRACT_STATUSES.includes(body.status as LabelContractStatus)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    const contract = await updateLabelContractStatus(
      id,
      body.status as LabelContractStatus,
    );
    return NextResponse.json(contract);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o contrato.",
      },
      { status: 400 },
    );
  }
}
