import { FileSignature, Search } from "lucide-react";
import Link from "next/link";
import Container from "@/components/container";
import ContractActions from "@/components/label-os/contract-actions";
import PageIntro from "@/components/page-intro";
import {
  LABEL_CONTRACT_STATUSES,
  LABEL_CONTRACT_STATUS_LABELS,
  LABEL_CONTRACT_TYPE_LABELS,
  type LabelContractStatus,
} from "@/lib/label-contract-types";
import { getLabelContracts } from "@/lib/label-contracts";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<LabelContractStatus, string> = {
  draft:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  generated:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300",
  sent: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-300",
  signed:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300",
  expired:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  cancelled:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300",
};

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function LabelContractsPage({ searchParams }: Props) {
  const params = await searchParams;
  const status = LABEL_CONTRACT_STATUSES.includes(
    params.status as LabelContractStatus,
  )
    ? (params.status as LabelContractStatus)
    : "all";
  const contracts = await getLabelContracts({ status, query: params.q });

  return (
    <div>
      <PageIntro
        eyebrow="Label OS"
        title="Contratos"
        description="Documentos gerados a partir das tracks, preservados como snapshots para assinatura e liberação."
      />

      <Container className="py-8">
        <form className="mb-6 grid gap-3 rounded-2xl border border-border bg-card/70 p-3 shadow-sm backdrop-blur-xl sm:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label className="relative">
            <span className="sr-only">Buscar contrato</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Buscar por música, artista ou número..."
              className="h-11 w-full rounded-xl border border-border bg-background/70 pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-blue-400"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar status</span>
            <select
              name="status"
              defaultValue={status}
              className="h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-blue-400"
            >
              <option value="all">Todos os status</option>
              {LABEL_CONTRACT_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {LABEL_CONTRACT_STATUS_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Filtrar
          </button>
        </form>

        {contracts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/45 px-6 py-16 text-center">
            <FileSignature className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 text-base font-semibold text-foreground">
              Nenhum contrato encontrado
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Abra uma track do catálogo, revise a etapa “Resumo e Contrato” e
              gere o primeiro documento.
            </p>
            <Link
              href="/label-os/tracks"
              className="mt-5 inline-flex h-10 items-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Abrir catálogo
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => (
              <article
                key={contract.id}
                className="grid gap-4 rounded-2xl border border-border bg-card/75 p-4 shadow-sm backdrop-blur-xl lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,.7fr)_minmax(0,1.4fr)] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[contract.status]}`}
                    >
                      {LABEL_CONTRACT_STATUS_LABELS[contract.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {contract.contract_number}
                    </span>
                  </div>
                  <Link
                    href={`/label-os/tracks/${contract.track_id}`}
                    className="mt-3 block truncate text-base font-semibold text-foreground underline-offset-4 hover:underline"
                  >
                    {contract.snapshot.track.title}
                  </Link>
                  <div className="mt-1 truncate text-sm text-muted-foreground">
                    {contract.snapshot.artists.primary.join(", ") ||
                      "Artista não informado"}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {contract.snapshot.participants.length} participante
                    {contract.snapshot.participants.length === 1
                      ? ""
                      : "s"} · {contract.snapshot.workspace.name}
                  </div>
                </div>

                <div className="text-sm">
                  <div className="text-xs text-muted-foreground">Tipo</div>
                  <div className="mt-1 font-medium text-foreground">
                    {LABEL_CONTRACT_TYPE_LABELS[contract.contract_type]}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {new Date(contract.generated_at).toLocaleDateString(
                      "pt-BR",
                      { timeZone: "America/Sao_Paulo" },
                    )}{" "}
                    · {contract.created_by_name ?? "Usuário"}
                  </div>
                </div>

                <ContractActions contract={contract} />
              </article>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
