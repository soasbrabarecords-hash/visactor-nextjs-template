import { NextResponse } from "next/server";
import {
  clearSpotifyNextCookie,
  clearSpotifyStateCookie,
  clearSpotifyWorkspaceCookie,
  exchangeSpotifyCode,
  getSpotifyNextCookie,
  getSpotifyRedirectUri,
  getSpotifyStateCookie,
  getSpotifyWorkspaceCookie,
  setSpotifyAuthCookies,
  syncSpotifyWorkspaceConnection,
} from "@/lib/spotify-user";
import { getCurrentWorkspaceContext } from "@/lib/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = await getSpotifyStateCookie();
  const expectedWorkspaceId = await getSpotifyWorkspaceCookie();
  const nextPath = await getSpotifyNextCookie();
  const safeNextPath = nextPath?.startsWith("/") ? nextPath : "/curadoria";
  const redirectUrl = new URL(safeNextPath, url.origin);

  if (!code || !state || state !== expectedState) {
    redirectUrl.searchParams.set("spotify_error", "Spotify callback invalido.");
    const response = NextResponse.redirect(redirectUrl);
    clearSpotifyStateCookie(response);
    clearSpotifyNextCookie(response);
    clearSpotifyWorkspaceCookie(response);

    return response;
  }

  try {
    if (expectedWorkspaceId) {
      const workspace = await getCurrentWorkspaceContext();

      if (workspace?.workspace.id !== expectedWorkspaceId) {
        throw new Error(
          "A conexao voltou para outro workspace. Tente conectar novamente no workspace correto.",
        );
      }
    }

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
    clearSpotifyWorkspaceCookie(response);

    return response;
  } catch (error) {
    redirectUrl.searchParams.set(
      "spotify_error",
      error instanceof Error ? error.message : "Spotify connection failed.",
    );
    const response = NextResponse.redirect(redirectUrl);
    clearSpotifyStateCookie(response);
    clearSpotifyNextCookie(response);
    clearSpotifyWorkspaceCookie(response);

    return response;
  }
}
