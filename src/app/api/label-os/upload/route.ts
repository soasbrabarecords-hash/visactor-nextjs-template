import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AllowedBucket = "label-audio" | "label-covers" | "label-contracts";

const ALLOWED_BUCKETS: AllowedBucket[] = [
  "label-audio",
  "label-covers",
  "label-contracts",
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bucket = formData.get("bucket") as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 400 });
    }

    if (!bucket || !ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
      return NextResponse.json({ error: "Bucket inválido." }, { status: 400 });
    }

    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const supabase = await createClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabase.storage
      .from(bucket as AllowedBucket)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data } = supabase.storage.from(bucket as AllowedBucket).getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
