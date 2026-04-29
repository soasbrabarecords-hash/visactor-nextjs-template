import { NextResponse } from "next/server";
import { createSpotifyPlaylist, setSpotifyAuthCookies } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatePlaylistBody = {
  name?: unknown;
  description?: unknown;
  isPublic?: unknown;
  coverBase64?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreatePlaylistBody;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const isPublic = body.isPublic !== false;
    const coverBase64 = typeof body.coverBase64 === "string" ? body.coverBase64 : null;

    if (!name) {
      return NextResponse.json({ message: "name é obrigatório." }, { status: 400 });
    }

    const { playlistId, refreshedToken } = await createSpotifyPlaylist(
      name,
      description,
      isPublic,
      coverBase64,
    );

    const res = NextResponse.json({ playlistId });
    if (refreshedToken) setSpotifyAuthCookies(res, refreshedToken);
    return res;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao criar playlist." },
      { status: 500 },
    );
  }
}
