import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  clearStoredAccounts,
  publicAccount,
  readStoredAccounts,
  storeAccountSession,
} from "@/lib/account-sessions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function displayName(user: User) {
  const metadata = user.user_metadata as Record<string, unknown>;
  const value = metadata.full_name ?? metadata.name ?? metadata.display_name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function avatarUrl(user: User) {
  const metadata = user.user_metadata as Record<string, unknown>;
  const value = metadata.avatar_url ?? metadata.picture;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function saveCurrentAccount() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Sua sessão expirou. Entre novamente." } as const;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.refresh_token || session.user.id !== user.id) {
    return { error: "Não foi possível proteger esta sessão." } as const;
  }

  await storeAccountSession({
    userId: user.id,
    email: user.email ?? null,
    displayName: displayName(user),
    avatarUrl: avatarUrl(user),
    refreshToken: session.refresh_token,
    updatedAt: new Date().toISOString(),
  });

  return { user } as const;
}

async function accountResponse() {
  const saved = await saveCurrentAccount();

  if ("error" in saved) {
    return NextResponse.json(
      { success: false, message: saved.error },
      { status: 401 },
    );
  }

  const accounts = (await readStoredAccounts()).map((session) => ({
    ...publicAccount(session),
    isCurrent: session.userId === saved.user.id,
  }));

  return NextResponse.json({
    success: true,
    currentUserId: saved.user.id,
    accounts,
  });
}

export async function GET() {
  try {
    return await accountResponse();
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as contas conectadas.",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    return await accountResponse();
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível manter esta conta conectada.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  await clearStoredAccounts();
  return NextResponse.json({ success: true });
}
