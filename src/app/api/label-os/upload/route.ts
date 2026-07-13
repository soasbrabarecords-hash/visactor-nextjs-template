import { NextResponse } from "next/server";
import {
  createLabelStoragePath,
  ensureLabelStorageBucket,
  isLabelStorageBucket,
  validateLabelStorageFile,
} from "@/lib/label-os-storage";
import { requireLabelWorkspaceId } from "@/lib/label-os-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bucket = formData.get("bucket") as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "Arquivo não encontrado." },
        { status: 400 },
      );
    }

    if (!isLabelStorageBucket(bucket)) {
      return NextResponse.json({ error: "Bucket inválido." }, { status: 400 });
    }

    const validationError = validateLabelStorageFile({
      bucket,
      contentType: file.type,
      size: file.size,
    });

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const workspaceId = await requireLabelWorkspaceId();
    await ensureLabelStorageBucket(bucket);
    const path = createLabelStoragePath(workspaceId, bucket, file.name);
    const supabase = createAdminClient() ?? (await createClient());
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      if (error.message.includes("row-level security policy")) {
        return NextResponse.json(
          {
            error:
              "O Storage do Supabase bloqueou o upload deste bucket. Configure policy de insert para usuarios autenticados ou defina SUPABASE_SERVICE_ROLE_KEY no servidor.",
          },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (bucket === "label-covers") {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return NextResponse.json({ url: data.publicUrl }, { status: 200 });
    }

    const signed = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 30);

    if (signed.error) {
      return NextResponse.json(
        { error: signed.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: signed.data.signedUrl }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
