import { NextResponse } from "next/server";
import { getMusicIntelligence } from "@/lib/music-intelligence";
import { getPlaylistOsReadAccess } from "@/lib/playlist-os-read-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

export async function GET() {
  try {
    const access = await getPlaylistOsReadAccess();

    if (!access.allowed) {
      return NextResponse.json(
        { success: false, message: access.message },
        { status: access.status, headers: NO_STORE_HEADERS },
      );
    }

    const data = await getMusicIntelligence();
    return NextResponse.json(data, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Music Intelligence API failed: ${message}\n`);
    return NextResponse.json(
      {
        success: false,
        message: "Não foi possível montar o Music Intelligence agora.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
