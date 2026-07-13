import { NextResponse } from "next/server";
import {
  attachSignedLabelContract,
  getLabelContractById,
} from "@/lib/label-contracts";
import { validateLabelStorageFile } from "@/lib/label-os-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const contract = await getLabelContractById(id);
    if (!contract) {
      return NextResponse.json(
        { error: "Contrato não encontrado." },
        { status: 404 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Selecione o contrato assinado em PDF." },
        { status: 400 },
      );
    }
    const validationError = validateLabelStorageFile({
      bucket: "label-contracts",
      contentType: file.type,
      size: file.size,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const signature = new TextDecoder().decode(
      await file.slice(0, 5).arrayBuffer(),
    );
    if (signature !== "%PDF-") {
      return NextResponse.json(
        { error: "O arquivo enviado não é um PDF válido." },
        { status: 400 },
      );
    }

    const updated = await attachSignedLabelContract(contract, file);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível anexar o contrato assinado.",
      },
      { status: 400 },
    );
  }
}
