import { NextResponse } from "next/server";
import {
  createLabelStoragePath,
  ensureLabelStorageBucket,
  isLabelStorageBucket,
  validateLabelStorageFile,
} from "@/lib/label-os-storage";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadUrlRequest = {
  bucket?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UploadUrlRequest;
    const bucket = body.bucket ?? null;

    if (!isLabelStorageBucket(bucket)) {
      return NextResponse.json({ error: "Bucket invalido." }, { status: 400 });
    }

    if (!body.fileName?.trim()) {
      return NextResponse.json({ error: "Nome do arquivo nao informado." }, { status: 400 });
    }

    const validationError = validateLabelStorageFile({
      bucket,
      contentType: body.contentType ?? "",
      size: Number(body.size ?? 0),
    });

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const admin = await ensureLabelStorageBucket(bucket);
    const supabase = admin ?? (await createClient());
    const path = createLabelStoragePath(bucket, body.fileName);
    const signed = await supabase.storage.from(bucket).createSignedUploadUrl(path);

    if (signed.error) {
      return NextResponse.json(
        {
          error:
            signed.error.message.includes("row-level security") || !admin
              ? "Nao foi possivel autorizar o upload. Verifique as policies do Storage ou configure SUPABASE_SERVICE_ROLE_KEY no servidor."
              : signed.error.message,
        },
        { status: 500 },
      );
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);

    return NextResponse.json({
      bucket,
      path: signed.data.path,
      token: signed.data.token,
      signedUrl: signed.data.signedUrl,
      publicUrl: publicData.publicUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
