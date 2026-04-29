import { NextResponse } from "next/server";
import {
  updatePlaylistDetails,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateDetailsBody = {
  name?: unknown;
  description?: unknown;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const body = (await request.json()) as UpdateDetailsBody;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!name) {
      return NextResponse.json({ message: "name é obrigatório." }, { status: 400 });
    }

    const { result, refreshedToken } = await updatePlaylistDetails(
      playlistId,
      name,
      description,
    );

    const response = NextResponse.json(result);

    if (refreshedToken) {
      setSpotifyAuthCookies(response, refreshedToken);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao atualizar playlist." },
      { status: 500 },
    );
  }
}
