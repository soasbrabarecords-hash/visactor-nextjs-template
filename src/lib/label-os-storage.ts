import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type LabelStorageBucket = "label-audio" | "label-covers" | "label-contracts";

type LabelStorageBucketConfig = {
  public: boolean;
  maxSizeBytes: number;
  allowedMimeTypes: string[];
};

export const LABEL_STORAGE_BUCKETS: Record<LabelStorageBucket, LabelStorageBucketConfig> = {
  "label-audio": {
    public: false,
    maxSizeBytes: 250 * 1024 * 1024,
    allowedMimeTypes: ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3"],
  },
  "label-covers": {
    public: true,
    maxSizeBytes: 20 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  "label-contracts": {
    public: false,
    maxSizeBytes: 25 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
  },
};

export function isLabelStorageBucket(bucket: string | null): bucket is LabelStorageBucket {
  return Boolean(bucket && bucket in LABEL_STORAGE_BUCKETS);
}

export function validateLabelStorageFile({
  bucket,
  contentType,
  size,
}: {
  bucket: LabelStorageBucket;
  contentType: string;
  size: number;
}) {
  const config = LABEL_STORAGE_BUCKETS[bucket];

  if (size > config.maxSizeBytes) {
    return `Arquivo maior que o limite de ${Math.round(config.maxSizeBytes / 1024 / 1024)}MB.`;
  }

  if (contentType && !config.allowedMimeTypes.includes(contentType)) {
    return "Tipo de arquivo nao permitido para este campo.";
  }

  return null;
}

export function createLabelStoragePath(bucket: LabelStorageBucket, fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const folder = bucket.replace("label-", "");
  return `${folder}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

export async function ensureLabelStorageBucket(bucket: LabelStorageBucket) {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const config = LABEL_STORAGE_BUCKETS[bucket];
  const current = await admin.storage.getBucket(bucket);

  if (!current.error) {
    return admin;
  }

  const created = await admin.storage.createBucket(bucket, {
    public: config.public,
    fileSizeLimit: config.maxSizeBytes,
    allowedMimeTypes: config.allowedMimeTypes,
  });

  if (created.error && !created.error.message.toLowerCase().includes("already exists")) {
    throw new Error(`Nao foi possivel preparar o bucket ${bucket}: ${created.error.message}`);
  }

  return admin;
}
