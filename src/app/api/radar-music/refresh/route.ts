import { NextResponse } from "next/server";
import { getMusicChartsData } from "@/lib/music-charts-data";

type RefreshRequestBody = {
  country?: string;
  genre?: string;
};

export async function POST(request: Request) {
  let body: RefreshRequestBody = {};

  try {
    body = (await request.json()) as RefreshRequestBody;
  } catch {
    body = {};
  }

  try {
    const data = await getMusicChartsData({
      country: body.country,
      genre: body.genre,
    });

    return NextResponse.json({
      success: true,
      message:
        data.workbenchTracks.length > 0
          ? `Radar atualizado com ${data.workbenchTracks.length} faixas processadas.`
          : "Radar atualizado, mas sem faixas ativas neste recorte.",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel atualizar o radar agora.";

    return NextResponse.json(
      {
        success: false,
        message,
        updatedAt: new Date().toISOString(),
      },
      {
        status: 500,
      },
    );
  }
}
