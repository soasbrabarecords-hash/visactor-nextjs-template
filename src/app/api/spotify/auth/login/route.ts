import { NextResponse } from "next/server";
import {
  buildSpotifyAuthorizeUrl,
  setSpotifyNextCookie,
  setSpotifyStateCookie,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    const state = crypto.randomUUID();
    const redirectUrl = await buildSpotifyAuthorizeUrl({
      origin,
      state,
    });
    const response = NextResponse.redirect(redirectUrl);
    const nextPath = requestUrl.searchParams.get("next");

    setSpotifyStateCookie(response, state);

    if (nextPath && nextPath.startsWith("/")) {
      setSpotifyNextCookie(response, nextPath);
    }

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
