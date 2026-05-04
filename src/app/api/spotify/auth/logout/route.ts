import { NextResponse } from "next/server";
import { clearSpotifyAuthCookies } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = requestUrl.searchParams.get("next");
  const targetPath =
    nextPath && nextPath.startsWith("/") ? nextPath : "/curadoria";
  const response = NextResponse.redirect(new URL(targetPath, request.url));

  clearSpotifyAuthCookies(response);

  return response;
}
