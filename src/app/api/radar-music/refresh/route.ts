import { NextResponse } from "next/server";
import { getMusicChartsData } from "@/lib/music-charts-data";
import { importSpotifyChartsCsvFromUrl } from "@/lib/spotify-charts-csv";

type RefreshRequestBody = {
  country?: string;
  genre?: string;
};

export async function POST(request: Request) {
  const updatedAt = new Date().toISOString();
  let body: RefreshRequestBody = {};

  try {
    body = (await request.json()) as RefreshRequestBody;
  } catch {
    body = {};
  }

  const csvUrl = process.env.SPOTIFY_CHARTS_CSV_URL;

  try {
    let importedCount = 0;
    let skippedCount = 0;
    let errors: string[] = [];
    let message =
      "CSV URL nao configurada; radar reprocessado sem streams.";
    let importSucceeded = true;

    if (csvUrl) {
      try {
        const importResult = await importSpotifyChartsCsvFromUrl({
          csvUrl,
          country: body.country,
          genre: body.genre,
        });

        importedCount = importResult.insertedCount;
        skippedCount = importResult.skippedCount;
        errors = importResult.errors;
        message =
          importedCount > 0
            ? `CSV importado com ${importedCount} linhas validas antes do refresh do radar.`
            : "CSV processado sem novas linhas validas; radar reprocessado com base atual.";
      } catch (error) {
        importSucceeded = false;
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Falha ao importar o CSV de streams.";
        errors = [
          errorMessage,
        ];
        message =
          `${errorMessage} Radar reprocessado com os dados atuais disponiveis.`;
      }
    }

    const data = await getMusicChartsData({
      country: body.country,
      genre: body.genre,
    });

    const refreshMessage =
      data.workbenchTracks.length > 0
        ? ` Radar atualizado com ${data.workbenchTracks.length} faixas processadas.`
        : " Radar atualizado, mas sem faixas ativas neste recorte.";

    return NextResponse.json({
      success: importSucceeded,
      importedCount,
      skippedCount,
      errors,
      message: `${message}${refreshMessage}`,
      updatedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nao foi possivel atualizar o radar agora.";

    return NextResponse.json(
      {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errors: [message],
        message,
        updatedAt,
      },
      {
        status: 500,
      },
    );
  }
}
