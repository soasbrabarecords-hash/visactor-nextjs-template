import { NextResponse } from "next/server";
import {
  clearSpotifyStateCookie,
  exchangeSpotifyCode,
  getSpotifyStateCookie,
  setSpotifyAuthCookies,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = await getSpotifyStateCookie();
  const redirectUrl = new URL("/curadoria", url.origin);

  if (!code || !state || state !== expectedState) {
    redirectUrl.searchParams.set("spotify_error", "Spotify callback invalido.");
    const response = NextResponse.redirect(redirectUrl);
    clearSpotifyStateCookie(response);

    return response;
  }

  try {
    const token = await exchangeSpotifyCode({
      code,
      redirectUri: `${url.origin}/api/spotify/auth/callback`,
    });
    redirectUrl.searchParams.set("spotify", "connected");
    const response = NextResponse.redirect(redirectUrl);

    setSpotifyAuthCookies(response, token);
    clearSpotifyStateCookie(response);

    return response;
  } catch (error) {
    redirectUrl.searchParams.set(
      "spotify_error",
      error instanceof Error ? error.message : "Spotify connection failed.",
    );
    const response = NextResponse.redirect(redirectUrl);
    clearSpotifyStateCookie(response);

    return response;
  }
}
