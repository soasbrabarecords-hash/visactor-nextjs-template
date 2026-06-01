import { NextResponse } from "next/server";
import {
  AccessAdminError,
  getAccessAdminData,
  removeAccessWorkspaceUser,
  updateAccessModuleRoles,
  updateAccessWorkspaceModules,
  upsertAccessWorkspace,
  upsertAccessWorkspaceUser,
} from "@/lib/access-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccessActionBody = {
  action?: unknown;
  workspace?: {
    id?: string | null;
    name?: string | null;
    slug?: string | null;
    type?: string | null;
    status?: string | null;
  };
  workspaceUser?: {
    workspaceId?: string | null;
    userId?: string | null;
    email?: string | null;
    temporaryPassword?: string | null;
    role?: string | null;
    status?: string | null;
  };
  modules?: {
    workspaceId?: string | null;
    modules?: Array<{ moduleKey?: string; isEnabled?: boolean }>;
  };
  permissions?: {
    workspaceId?: string | null;
    userId?: string | null;
    roles?: Array<{ moduleKey?: string; role?: string }>;
  };
};

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Erro ao gerenciar acessos.";
  const status = error instanceof AccessAdminError ? error.status : 400;

  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
    },
  );
}

export async function GET() {
  try {
    const data = await getAccessAdminData();

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
    const body = (await request.json()) as AccessActionBody;
    let mutation:
      | Awaited<ReturnType<typeof upsertAccessWorkspaceUser>>
      | null = null;

    if (body.action === "upsert_workspace") {
      await upsertAccessWorkspace(body.workspace ?? {});
    } else if (body.action === "upsert_workspace_user") {
      mutation = await upsertAccessWorkspaceUser(body.workspaceUser ?? {});
    } else if (body.action === "remove_workspace_user") {
      await removeAccessWorkspaceUser(body.workspaceUser ?? {});
    } else if (body.action === "update_modules") {
      await updateAccessWorkspaceModules(body.modules ?? {});
    } else if (body.action === "update_permissions") {
      await updateAccessModuleRoles(body.permissions ?? {});
    } else {
      throw new AccessAdminError("Ação inválida.");
    }

    const data = await getAccessAdminData();

    return NextResponse.json({
      success: true,
      data,
      mutation,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
