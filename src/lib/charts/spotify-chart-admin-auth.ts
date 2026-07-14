import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { ACCESS_ADMIN_EMAIL } from "@/lib/workspace-access";

export type SpotifyChartsAdminAuthorization =
  | { authorized: true; userId: string | null; mode: "session" | "operation" }
  | {
      authorized: false;
      status: 401 | 403 | 503;
      error: "unauthorized" | "forbidden" | "admin_not_configured";
    };

function hasValidOperationSecret(request: Request) {
  const expected = process.env.SPOTIFY_CHARTS_OPERATION_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  const provided = authorization.startsWith(prefix)
    ? authorization.slice(prefix.length)
    : "";

  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export async function authorizeSpotifyChartsAdminRequest(
  request: Request,
): Promise<SpotifyChartsAdminAuthorization> {
  if (hasValidOperationSecret(request)) {
    return { authorized: true, userId: null, mode: "operation" };
  }

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");

  if (!origin || origin !== requestOrigin) {
    return { authorized: false, status: 403, error: "forbidden" };
  }

  const configuredAdminId =
    process.env.SPOTIFY_CHARTS_ADMIN_USER_ID?.trim() || null;

  if (!configuredAdminId) {
    return {
      authorized: false,
      status: 503,
      error: "admin_not_configured",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { authorized: false, status: 401, error: "unauthorized" };
  }

  const isAdminEmail = user.email?.trim().toLowerCase() === ACCESS_ADMIN_EMAIL;
  const isAdminId = user.id === configuredAdminId;

  if (!isAdminEmail || !isAdminId) {
    return { authorized: false, status: 403, error: "forbidden" };
  }

  return { authorized: true, userId: user.id, mode: "session" };
}
