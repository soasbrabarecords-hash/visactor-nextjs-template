import { NextResponse } from "next/server";
import {
  buildSpotifyAuthorizeUrl,
  setSpotifyStateCookie,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const state = crypto.randomUUID();
    const redirectUrl = buildSpotifyAuthorizeUrl({
      origin,
      state,
    });
    const response = NextResponse.redirect(redirectUrl);

    setSpotifyStateCookie(response, state);

    return response;
  } catch (error) {
    const url = new URL("/curadoria", request.url);
    url.searchParams.set(
      "spotify_error",
      error instanceof Error ? error.message : "Spotify connection failed.",
    );

    return NextResponse.redirect(url);
  }
}
