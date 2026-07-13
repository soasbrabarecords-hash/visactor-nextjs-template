import { NextResponse } from "next/server";
import {
  AccessAdminError,
  createInternalAccount,
  getGlobalAdminSummary,
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
    const data = await getGlobalAdminSummary();

    return NextResponse.json({
      success: true,
      data,
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
