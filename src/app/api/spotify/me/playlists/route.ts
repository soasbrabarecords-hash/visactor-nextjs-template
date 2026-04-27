import { NextResponse } from "next/server";
import {
  fetchSpotifyAccountPlaylists,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { result, refreshedToken } = await fetchSpotifyAccountPlaylists();
  const response = NextResponse.json(result);

  if (refreshedToken) {
    setSpotifyAuthCookies(response, refreshedToken);
  }

  return response;
}
