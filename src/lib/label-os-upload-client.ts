type LabelStorageBucket = "label-audio" | "label-covers" | "label-contracts";

type SignedUploadResponse = {
  bucket: LabelStorageBucket;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
};

async function readUploadError(res: Response, fallback: string) {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function uploadCoverWithSignedUrl(file: File) {
  const ticketRes = await fetch("/api/label-os/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket: "label-covers",
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!ticketRes.ok) {
    throw new Error(await readUploadError(ticketRes, "Erro ao preparar upload da capa."));
  }

  const ticket = (await ticketRes.json()) as SignedUploadResponse;
  const uploadForm = new FormData();
  uploadForm.append("cacheControl", "3600");
  uploadForm.append("", file);

  const uploadRes = await fetch(ticket.signedUrl, {
    method: "PUT",
    headers: {
      "x-upsert": "false",
    },
    body: uploadForm,
  });

  if (!uploadRes.ok) {
    throw new Error(await readUploadError(uploadRes, "Erro ao enviar capa para o Storage."));
  }

  return ticket.publicUrl;
}

async function uploadThroughApi(file: File, bucket: LabelStorageBucket) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("bucket", bucket);

  const res = await fetch("/api/label-os/upload", { method: "POST", body: fd });

  if (!res.ok) {
    throw new Error(await readUploadError(res, `Erro no upload para ${bucket}`));
  }

  const json = (await res.json()) as { url: string };
  return json.url;
}

export async function uploadLabelOsFile(file: File | null, bucket: LabelStorageBucket) {
  if (!file || file.size === 0) return null;

  if (bucket === "label-covers") {
    return uploadCoverWithSignedUrl(file);
  }

  return uploadThroughApi(file, bucket);
}
