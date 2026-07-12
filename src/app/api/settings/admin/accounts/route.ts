import { NextResponse } from "next/server";
import {
  AccessAdminError,
  createInternalAccount,
  getAccessAdminData,
} from "@/lib/access-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccountBody = {
  displayName?: string | null;
  email?: string | null;
  temporaryPassword?: string | null;
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  workspaceType?: string | null;
  enabledModules?: string[] | null;
};

function errorResponse(error: unknown) {
  return NextResponse.json(
    {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Erro na administração global.",
    },
    {
      status: error instanceof AccessAdminError ? error.status : 400,
    },
  );
}

export async function GET() {
  try {
    const data = await getAccessAdminData();

    if (!data.isGlobalAdmin) {
      throw new AccessAdminError(
        "Administração global disponível somente para contato@soasbraba.com.",
        403,
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        currentUserEmail: data.currentUserEmail,
        totalAccounts: data.workspaces.length,
        activeAccounts: data.stats.activeWorkspaces,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AccountBody;
    const mutation = await createInternalAccount(body);

    return NextResponse.json({
      success: true,
      mutation,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
