import { NextResponse } from "next/server";
import { createLabelContractFromTrack } from "@/lib/label-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const contract = await createLabelContractFromTrack(id);
    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o contrato.",
      },
      { status: 400 },
    );
  }
}
