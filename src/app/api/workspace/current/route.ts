import { NextResponse } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  workspaceId?: unknown;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null;
    const workspaceId =
      typeof body?.workspaceId === "string" ? body.workspaceId.trim() : "";

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, message: "Selecione um workspace." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const dataClient = createAdminClient() ?? supabase;
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Sessao expirada." },
        { status: 401 },
      );
    }

    const [
      { data: workspaceUserRows, error: workspaceUserError },
      { data: membershipRows, error: membershipError },
      { data: workspace, error: workspaceError },
    ] = await Promise.all([
      dataClient
        .from("workspace_users")
        .select("workspace_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1),
      dataClient
        .from("workspace_memberships")
        .select("workspace_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .limit(1),
      dataClient
        .from("workspaces")
        .select("id, status")
        .eq("id", workspaceId)
        .maybeSingle(),
    ]);

    if (workspaceUserError || membershipError || workspaceError) {
      throw workspaceUserError ?? membershipError ?? workspaceError;
    }

    const canAccessWorkspace =
      Boolean(workspaceUserRows?.length) || Boolean(membershipRows?.length);

    if (!workspace || workspace.status !== "active" || !canAccessWorkspace) {
      return NextResponse.json(
        { success: false, message: "Workspace indisponivel para este usuario." },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(
      ACTIVE_WORKSPACE_COOKIE,
      workspaceId,
      cookieOptions(60 * 60 * 24 * 365),
    );

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nao foi possivel trocar workspace.";

    return NextResponse.json(
      { success: false, message },
      { status: 500 },
    );
  }
}
