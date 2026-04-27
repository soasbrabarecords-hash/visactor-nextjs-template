import { NextResponse } from "next/server";
import { importSpotifyChartsCsvContent } from "@/lib/spotify-charts-csv";

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
    const result = await importSpotifyChartsCsvContent({
      csvText,
      country: typeof countryValue === "string" ? countryValue : undefined,
      genre: typeof genreValue === "string" ? genreValue : undefined,
    });

    return NextResponse.json({
      success: result.insertedCount > 0 || result.errors.length === 0,
      importedCount: result.insertedCount,
      skippedCount: result.skippedCount,
      errors: result.errors,
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
