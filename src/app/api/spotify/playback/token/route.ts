import { NextResponse } from "next/server";
import { setSpotifyAuthCookies, withSpotifyToken } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data: accessToken, refreshedToken } = await withSpotifyToken(
      async (token) => token,
    );
    const response = NextResponse.json({ accessToken });

    if (refreshedToken) {
      setSpotifyAuthCookies(response, refreshedToken);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel autorizar o player do Spotify.",
      },
      { status: 401 },
    );
  }
}
