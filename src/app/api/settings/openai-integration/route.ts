import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        "A inteligência do Playlist OS agora é administrada globalmente pelo sistema. Nenhuma chave por workspace é necessária.",
    },
    { status: 410 },
  );
}
