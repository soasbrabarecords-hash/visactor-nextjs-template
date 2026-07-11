import { NextResponse } from "next/server";
import { parseChartDateFromFilename } from "@/lib/spotify-charts-csv";
import { importSpotifyChartCsv } from "@/lib/charts/import-spotify-chart-csv";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const countryValue = formData.get("country");
    const genreValue = formData.get("genre");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          importedCount: 0,
          skippedCount: 0,
          errors: ["Arquivo CSV nao enviado."],
        },
        {
          status: 400,
        },
      );
    }

    const csvText = await file.text();
    const result = await importSpotifyChartCsv({
      csvText,
      chartType: "top-songs",
      country:
        typeof countryValue === "string" && countryValue.trim()
          ? countryValue
          : "BR",
      chartDate:
        parseChartDateFromFilename(file.name) ??
        new Date().toISOString().slice(0, 10),
      genre: typeof genreValue === "string" ? genreValue : undefined,
      enrichSpotifyMetadata: true,
    });

    return NextResponse.json({
      success: result.insertedCount > 0 || result.errors.length === 0,
      importedCount: result.insertedCount,
      skippedCount: result.skippedCount,
      errors: result.errors,
      debug: result.debug ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errors: [
          error instanceof Error
            ? error.message
            : "Nao foi possivel importar o CSV agora.",
        ],
      },
      {
        status: 500,
      },
    );
  }
}
