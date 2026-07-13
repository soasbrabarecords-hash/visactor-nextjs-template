"use client";

import { FileSignature, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ContractActions from "@/components/label-os/contract-actions";
import type { LabelContract } from "@/lib/label-contract-types";

async function readError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? "Não foi possível gerar o contrato.";
  } catch {
    return "Não foi possível gerar o contrato.";
  }
}

export default function ContractGenerationControls({
  trackId,
  contracts,
}: {
  trackId: string;
  contracts: LabelContract[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/label-os/tracks/${trackId}/contracts`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await readError(response));
      } else {
        router.refresh();
      }
    } catch {
      setError("Não foi possível acessar o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">
            Documento operacional
          </div>
          <p className="text-white/54 mt-1 max-w-xl text-sm leading-6">
            Gera um PDF formal e congela uma cópia dos dados atuais. Alterações
            futuras na track não modificam contratos já criados.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <FileSignature className="h-4 w-4" />
          )}
          {loading ? "Gerando PDF..." : "Gerar contrato"}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-300/20 bg-rose-300/[0.08] px-3 py-2 text-xs text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {contracts.length > 0 ? (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div className="text-white/36 text-[11px] uppercase tracking-[0.2em]">
            Contratos desta track
          </div>
          {contracts.map((contract) => (
            <div
              key={contract.id}
              className="rounded-2xl border border-white/10 bg-black/10 p-3"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-white">
                    {contract.contract_number}
                  </div>
                  <div className="text-white/42 mt-1 text-xs">
                    Gerado em{" "}
                    {new Date(contract.generated_at).toLocaleDateString(
                      "pt-BR",
                      { timeZone: "America/Sao_Paulo" },
                    )}
                  </div>
                </div>
              </div>
              <ContractActions contract={contract} compact darkSurface />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
