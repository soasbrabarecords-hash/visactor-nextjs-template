import { NextResponse } from "next/server";
import { clearSpotifyAuthCookies } from "@/lib/spotify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/curadoria", request.url));

  clearSpotifyAuthCookies(response);

  return response;
}
