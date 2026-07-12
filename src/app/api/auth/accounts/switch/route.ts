import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  publicAccount,
  readStoredAccount,
  removeStoredAccount,
  storeAccountSession,
} from "@/lib/account-sessions";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function accountFromUser(user: User, refreshToken: string) {
  const metadata = user.user_metadata as Record<string, unknown>;
  const rawName = metadata.full_name ?? metadata.name ?? metadata.display_name;
  const rawAvatar = metadata.avatar_url ?? metadata.picture;

  return {
    userId: user.id,
    email: user.email ?? null,
    displayName:
      typeof rawName === "string" && rawName.trim() ? rawName.trim() : null,
    avatarUrl:
      typeof rawAvatar === "string" && rawAvatar.trim()
        ? rawAvatar.trim()
        : null,
    refreshToken,
    updatedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      userId?: unknown;
    } | null;
    const userId = typeof body?.userId === "string" ? body.userId : null;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Selecione uma conta válida." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Sua sessão expirou. Entre novamente." },
        { status: 401 },
      );
    }

    if (currentUser.id === userId) {
      return NextResponse.json({ success: true, unchanged: true });
    }

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (
      currentSession?.refresh_token &&
      currentSession.user.id === currentUser.id
    ) {
      await storeAccountSession(
        accountFromUser(currentUser, currentSession.refresh_token),
      );
    }

    const targetAccount = await readStoredAccount(userId);

    if (!targetAccount) {
      return NextResponse.json(
        {
          success: false,
          message: "Esta conta não está mais conectada. Adicione-a novamente.",
        },
        { status: 404 },
      );
    }

    const {
      data: { session: targetSession },
      error: refreshError,
    } = await supabase.auth.refreshSession({
      refresh_token: targetAccount.refreshToken,
    });

    if (
      refreshError ||
      !targetSession?.refresh_token ||
      targetSession.user.id !== userId
    ) {
      await removeStoredAccount(userId);
      return NextResponse.json(
        {
          success: false,
          message: "A sessão desta conta expirou. Adicione-a novamente.",
        },
        { status: 401 },
      );
    }

    const refreshedAccount = accountFromUser(
      targetSession.user,
      targetSession.refresh_token,
    );
    await storeAccountSession(refreshedAccount);

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return NextResponse.json({
      success: true,
      account: publicAccount(refreshedAccount),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível trocar de conta.",
      },
      { status: 500 },
    );
  }
}
