import { NextResponse } from "next/server";
import {
  clearSpotifyNextCookie,
  clearSpotifyStateCookie,
  exchangeSpotifyCode,
  getSpotifyNextCookie,
  getSpotifyRedirectUri,
  getSpotifyStateCookie,
  setSpotifyAuthCookies,
  syncSpotifyWorkspaceConnection,
} from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = await getSpotifyStateCookie();
  const nextPath = await getSpotifyNextCookie();
  const safeNextPath = nextPath?.startsWith("/") ? nextPath : "/curadoria";
  const redirectUrl = new URL(safeNextPath, url.origin);

  if (!code || !state || state !== expectedState) {
    redirectUrl.searchParams.set("spotify_error", "Spotify callback invalido.");
    const response = NextResponse.redirect(redirectUrl);
    clearSpotifyStateCookie(response);
    clearSpotifyNextCookie(response);

    return response;
  }

  try {
    const token = await exchangeSpotifyCode({
      code,
      redirectUri: getSpotifyRedirectUri(url.origin),
    });
    await syncSpotifyWorkspaceConnection(token);
    redirectUrl.searchParams.set("spotify", "connected");
    const response = NextResponse.redirect(redirectUrl);

    setSpotifyAuthCookies(response, token);
    clearSpotifyStateCookie(response);
    clearSpotifyNextCookie(response);

    return response;
  } catch (error) {
    redirectUrl.searchParams.set(
      "spotify_error",
      error instanceof Error ? error.message : "Spotify connection failed.",
    );
    const response = NextResponse.redirect(redirectUrl);
    clearSpotifyStateCookie(response);
    clearSpotifyNextCookie(response);

    return response;
  }
}
