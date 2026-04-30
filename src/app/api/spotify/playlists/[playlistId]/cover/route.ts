import { NextResponse } from "next/server";
import {
  uploadPlaylistCover,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadCoverBody = {
  imageBase64?: unknown;
};

// Spotify limita upload de capa a 256 KB (base64)
const MAX_BASE64_SIZE = 256 * 1024;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const body = (await request.json()) as UploadCoverBody;

    if (typeof body.imageBase64 !== "string" || !body.imageBase64.trim()) {
      return NextResponse.json(
        { message: "imageBase64 é obrigatório (JPEG em base64 sem prefixo)." },
        { status: 400 },
      );
    }

    // Remove prefixo data:image/...;base64, se presente
    const base64 = body.imageBase64.replace(/^data:image\/[a-z]+;base64,/, "").trim();

    if (base64.length > MAX_BASE64_SIZE) {
      return NextResponse.json(
        { message: "Imagem maior que 256 KB. Reduza a resolução/qualidade." },
        { status: 413 },
      );
    }

    const { result, refreshedToken } = await uploadPlaylistCover(
      playlistId,
      base64,
    );

    const response = NextResponse.json(result);

    if (refreshedToken) {
      setSpotifyAuthCookies(response, refreshedToken);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Erro ao atualizar capa.",
      },
      { status: 500 },
    );
  }
}
