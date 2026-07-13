import { NextResponse } from "next/server";
import {
  downloadLabelContractFile,
  getLabelContractById,
} from "@/lib/label-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const contract = await getLabelContractById(id);
    if (!contract) {
      return NextResponse.json(
        { error: "Contrato não encontrado." },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    const kind =
      url.searchParams.get("kind") === "signed" ? "signed" : "generated";
    const download = url.searchParams.get("download") === "1";
    const file = await downloadLabelContractFile(contract, kind);
    const baseName =
      `${contract.contract_number}-${contract.snapshot.track.title}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/-+/g, "-");

    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${baseName}${kind === "signed" ? "-assinado" : ""}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível abrir o contrato.",
      },
      { status: 400 },
    );
  }
}
