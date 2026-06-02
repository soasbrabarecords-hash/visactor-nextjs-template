import { NextResponse } from "next/server";
import {
  fetchSpotifyWorkspaceDiagnostics,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const playlistId = url.searchParams.get("playlistId");
  const { result, refreshedToken } = await fetchSpotifyWorkspaceDiagnostics({
    playlistId,
  });
  const response = NextResponse.json(result);

  if (refreshedToken) {
    setSpotifyAuthCookies(response, refreshedToken);
  }

  return response;
}
