"use client";

import { Download, Eye, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { LabelContract } from "@/lib/label-contract-types";
import {
  LABEL_CONTRACT_STATUSES,
  LABEL_CONTRACT_STATUS_LABELS,
} from "@/lib/label-contract-types";

async function readError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export default function ContractActions({
  contract,
  compact = false,
  darkSurface = false,
}: {
  contract: LabelContract;
  compact?: boolean;
  darkSurface?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(status: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/label-os/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setError(
          await readError(response, "Não foi possível alterar o status."),
        );
      } else {
        router.refresh();
      }
    } catch {
      setError("Não foi possível acessar o servidor.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSigned(file: File) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(
        `/api/label-os/contracts/${contract.id}/signed`,
        { method: "POST", body: formData },
      );
      if (!response.ok) {
        setError(
          await readError(
            response,
            "Não foi possível anexar o contrato assinado.",
          ),
        );
      } else {
        router.refresh();
      }
    } catch {
      setError("Não foi possível acessar o servidor.");
    } finally {
      setBusy(false);
    }
  }

  const sizeClass = compact ? "h-9 px-3" : "h-10 px-3.5";
  const surfaceClass = darkSurface
    ? "border-white/10 bg-white/[0.04] text-white/76 hover:bg-white/[0.08] hover:text-white"
    : "border-border bg-background/65 text-foreground hover:bg-accent";
  const buttonClass = `inline-flex ${sizeClass} items-center gap-2 rounded-xl border text-xs font-medium transition disabled:opacity-50 ${surfaceClass}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/label-os/contracts/${contract.id}/file`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass}
        >
          <Eye className="h-3.5 w-3.5" />
          Ver PDF
        </a>
        <a
          href={`/api/label-os/contracts/${contract.id}/file?download=1`}
          className={buttonClass}
        >
          <Download className="h-3.5 w-3.5" />
          Baixar
        </a>
        {contract.signed_pdf_path ? (
          <a
            href={`/api/label-os/contracts/${contract.id}/file?kind=signed`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass}
          >
            <Eye className="h-3.5 w-3.5" />
            Ver assinado
          </a>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={buttonClass}
        >
          <Upload className="h-3.5 w-3.5" />
          {contract.signed_pdf_path ? "Substituir assinado" : "Anexar assinado"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadSigned(file);
            event.target.value = "";
          }}
        />
        <label className="sr-only" htmlFor={`contract-status-${contract.id}`}>
          Status do contrato
        </label>
        <select
          id={`contract-status-${contract.id}`}
          value={contract.status}
          disabled={busy}
          onChange={(event) => void changeStatus(event.target.value)}
          className={`h-10 rounded-xl border px-3 text-xs font-medium outline-none transition disabled:opacity-50 ${
            darkSurface
              ? "text-white/82 border-white/10 bg-[#121a2a] focus:border-sky-200/30"
              : "border-border bg-background text-foreground focus:border-blue-400"
          }`}
        >
          {LABEL_CONTRACT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {LABEL_CONTRACT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p
          role="alert"
          className={
            darkSurface
              ? "text-xs text-rose-200"
              : "text-xs text-rose-600 dark:text-rose-300"
          }
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
