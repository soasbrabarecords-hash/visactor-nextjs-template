"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Clock3,
  ListChecks,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  LabelTrackReadiness,
  LabelTrackReadinessInput,
  LabelTrackTask,
  ReadinessAreaKey,
  ReadinessPriority,
  ReadinessTaskStatus,
  TrackReadinessResult,
} from "@/lib/label-readiness-types";
import {
  EMPTY_TRACK_READINESS,
  READINESS_AREAS,
  READINESS_AREA_LABELS,
} from "@/lib/label-readiness-types";
import { cn } from "@/lib/utils";

type TabKey = "overview" | "checklist" | "operation";

const PRIORITY_LABEL: Record<ReadinessPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const TASK_STATUS_LABEL: Record<ReadinessTaskStatus, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  done: "Concluída",
};

const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-none outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-primary/20";

function manualInputFromRow(
  row: LabelTrackReadiness | null,
): LabelTrackReadinessInput {
  if (!row) return { ...EMPTY_TRACK_READINESS };
  return {
    work_registered: row.work_registered,
    work_registration_society: row.work_registration_society,
    work_registration_proof_attached: row.work_registration_proof_attached,
    p_line: row.p_line,
    c_line: row.c_line,
    master_owner: row.master_owner,
    wav_approved: row.wav_approved,
    cover_approved: row.cover_approved,
    distributor: row.distributor,
    label_commission_percentage: row.label_commission_percentage,
    payment_data_confirmed: row.payment_data_confirmed,
    contracts_approved: row.contracts_approved,
    featured_contract_approved: row.featured_contract_approved,
    payment_rule: row.payment_rule,
    symphonic_release_created: row.symphonic_release_created,
    delivered_to_stores: row.delivered_to_stores,
    published: row.published,
    responsible: row.responsible,
    priority: row.priority,
    notes: row.notes,
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-white/58 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5 transition hover:bg-white/[0.055]">
      <span className="text-white/74 text-sm">{label}</span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="border-white/12 relative h-6 w-10 shrink-0 rounded-full border bg-white/10 transition peer-checked:border-emerald-300/30 peer-checked:bg-emerald-400/70">
        <span className="absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white/70 shadow-sm transition peer-checked:translate-x-4 peer-checked:bg-white" />
      </span>
    </label>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full p-[9px] shadow-[0_18px_52px_rgba(14,165,233,0.16)]"
      style={{
        background: `conic-gradient(rgb(56 189 248) ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
      }}
      aria-label={`${score}% pronta`}
    >
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-[#0c121d]">
        <span className="text-3xl font-semibold tracking-tight text-white">
          {score}%
        </span>
        <span className="text-white/38 mt-1 text-[10px] uppercase tracking-[0.18em]">
          pronta
        </span>
      </div>
    </div>
  );
}

function AreaRow({
  area,
  onOpenChecklist,
}: {
  area: TrackReadinessResult["areas"][number];
  onOpenChecklist: () => void;
}) {
  const isComplete = area.score === 100;
  return (
    <button
      type="button"
      onClick={onOpenChecklist}
      className="hover:border-white/16 group flex w-full items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.05]"
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
          isComplete
            ? "border-emerald-300/18 bg-emerald-300/10 text-emerald-200"
            : area.blockingCount > 0
              ? "border-rose-300/18 bg-rose-300/10 text-rose-200"
              : "border-amber-300/18 bg-amber-300/10 text-amber-200",
        )}
      >
        {isComplete ? (
          <Check size={16} />
        ) : (
          <span className="text-xs font-semibold">{area.score}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-white">{area.label}</span>
          <span className="text-white/42 text-xs">
            {area.completed}/{area.total}
          </span>
        </div>
        <div className="bg-white/8 mt-2 h-1 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full",
              isComplete
                ? "bg-emerald-300"
                : area.blockingCount > 0
                  ? "bg-sky-300"
                  : "bg-amber-300",
            )}
            style={{ width: `${area.score}%` }}
          />
        </div>
      </div>
      <ChevronRight className="text-white/22 group-hover:text-white/58 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
    </button>
  );
}

export default function ReleaseReadinessPanel({
  trackId,
  result,
  manual,
  tasks,
}: {
  trackId: string;
  result: TrackReadinessResult;
  manual: LabelTrackReadiness | null;
  tasks: LabelTrackTask[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");
  const [form, setForm] = useState<LabelTrackReadinessInput>(() =>
    manualInputFromRow(manual),
  );
  const [saving, setSaving] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskArea, setTaskArea] = useState<ReadinessAreaKey>("track");
  const [taskResponsible, setTaskResponsible] = useState(
    form.responsible ?? "",
  );
  const [taskPriority, setTaskPriority] = useState<ReadinessPriority>(
    form.priority,
  );
  const [taskDueDate, setTaskDueDate] = useState("");

  const openTasks = tasks.filter((task) => task.status !== "done");
  const nextAction = result.nextRecommendedAction;

  function updateForm<K extends keyof LabelTrackReadinessInput>(
    key: K,
    value: LabelTrackReadinessInput[K],
  ) {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveReadiness(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/label-os/tracks/${trackId}/readiness`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(
          payload.error ?? "Não foi possível salvar a conferência.",
        );
      setSaved(true);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Erro ao salvar.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    setTaskSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/label-os/tracks/${trackId}/readiness/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskTitle,
            area: taskArea,
            responsible: taskResponsible,
            priority: taskPriority,
            due_date: taskDueDate || null,
          }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "Não foi possível criar a tarefa.");
      setTaskTitle("");
      setTaskDueDate("");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Erro ao criar tarefa.",
      );
    } finally {
      setTaskSaving(false);
    }
  }

  async function updateTask(taskId: string, status: ReadinessTaskStatus) {
    setError(null);
    try {
      const response = await fetch(
        `/api/label-os/tracks/${trackId}/readiness/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(
          payload.error ?? "Não foi possível atualizar a tarefa.",
        );
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Erro ao atualizar tarefa.",
      );
    }
  }

  async function deleteTask(taskId: string) {
    setError(null);
    try {
      const response = await fetch(
        `/api/label-os/tracks/${trackId}/readiness/tasks/${taskId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Não foi possível excluir a tarefa.");
      }
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Erro ao excluir tarefa.",
      );
    }
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-5 laptop:flex-row laptop:items-center laptop:justify-between">
          <div className="flex items-center gap-3">
            <div className="border-sky-300/16 flex h-10 w-10 items-center justify-center rounded-xl border bg-sky-300/[0.08] text-sky-100">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sky-100/48 text-[11px] uppercase tracking-[0.2em]">
                Release Readiness
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
                Pronto para lançar
              </h2>
            </div>
          </div>

          <div className="inline-flex w-fit rounded-lg border border-border bg-muted/30 p-1">
            {(
              [
                ["overview", "Resumo", Sparkles],
                ["checklist", "Checklist", ListChecks],
                ["operation", "Operação", Clock3],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors",
                  tab === key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-white/52 hover:text-white",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="border-rose-300/18 mx-5 mt-5 rounded-2xl border bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-100 sm:mx-6">
          {error}
        </div>
      ) : null}

      {tab === "overview" ? (
        <div className="grid gap-6 p-5 sm:p-6 laptop:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="rounded-2xl border border-border bg-muted/20 p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <ScoreRing score={result.readinessScore} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                      result.isReadyToDistribute
                        ? "border-emerald-300/18 bg-emerald-300/10 text-emerald-100"
                        : "border-rose-300/18 bg-rose-300/10 text-rose-100",
                    )}
                  >
                    {result.isReadyToDistribute ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <XCircle size={13} />
                    )}
                    Pronto para subir:{" "}
                    {result.isReadyToDistribute ? "Sim" : "Não"}
                  </span>
                </div>
                <div className="mt-4 text-2xl font-semibold tracking-tight text-white">
                  {result.isReadyToDistribute
                    ? "Documentação liberada para distribuição."
                    : `${result.blockingIssues.length} bloqueio${result.blockingIssues.length === 1 ? "" : "s"} antes da distribuição.`}
                </div>
                <p className="text-white/52 mt-2 text-sm leading-6">
                  {result.blockingIssues[0] ??
                    result.warnings[0] ??
                    "Todos os itens operacionais foram conferidos."}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <div className="text-white/36 text-[10px] uppercase tracking-[0.16em]">
                  Bloqueios
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {result.blockingIssues.length}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <div className="text-white/36 text-[10px] uppercase tracking-[0.16em]">
                  Alertas
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {result.warnings.length}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <div className="text-white/36 text-[10px] uppercase tracking-[0.16em]">
                  Tarefas abertas
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {openTasks.length}
                </div>
              </div>
            </div>

            {nextAction ? (
              <div className="border-sky-300/14 mt-5 rounded-[22px] border bg-sky-300/[0.07] p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sky-100/54 text-[10px] uppercase tracking-[0.17em]">
                      Próxima ação
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {nextAction.title}
                    </div>
                    <div className="text-white/48 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound size={12} /> {nextAction.responsible}
                      </span>
                      <span>{PRIORITY_LABEL[nextAction.priority]}</span>
                      <span>{READINESS_AREA_LABELS[nextAction.area]}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid content-start gap-3 sm:grid-cols-2">
            {result.areas.map((area) => (
              <AreaRow
                key={area.key}
                area={area}
                onOpenChecklist={() => setTab("checklist")}
              />
            ))}
          </div>
        </div>
      ) : null}

      {tab === "checklist" ? (
        <div className="grid gap-4 p-5 sm:p-6 laptop:grid-cols-2">
          {result.areas.map((area) => (
            <details
              key={area.key}
              open={area.blockingCount > 0}
              className="group rounded-xl border border-border bg-muted/20"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-2xl border",
                    area.score === 100
                      ? "border-emerald-300/18 bg-emerald-300/10 text-emerald-200"
                      : "border-white/10 bg-white/[0.04] text-white/70",
                  )}
                >
                  {area.score === 100 ? (
                    <Check size={16} />
                  ) : (
                    <span className="text-xs">{area.score}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">
                    {area.label}
                  </div>
                  <div className="text-white/42 mt-1 text-xs">
                    {area.completed} de {area.total} itens completos
                  </div>
                </div>
                <ChevronRight className="text-white/28 h-4 w-4 transition group-open:rotate-90" />
              </summary>
              <div className="border-white/8 space-y-2 border-t px-3 py-3">
                {area.checks.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-2xl px-2 py-2.5"
                  >
                    {item.complete ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    ) : item.severity === "blocking" ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-sm",
                          item.complete
                            ? "text-white/68"
                            : "font-medium text-white",
                        )}
                      >
                        {item.title}
                      </div>
                      {!item.complete ? (
                        <div className="text-white/38 mt-1 text-xs">
                          {item.action}
                        </div>
                      ) : null}
                    </div>
                    <span className="border-white/8 text-white/32 shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em]">
                      {item.source === "automatic" ? "auto" : "manual"}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : null}

      {tab === "operation" ? (
        <div className="grid gap-5 p-5 sm:p-6 laptop:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
          <form
            onSubmit={saveReadiness}
            className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Conferência operacional
                </h3>
                <p className="text-white/46 mt-1 text-sm">
                  Somente os pontos que ainda não existem no cadastro principal.
                </p>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-sky-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-50"
              >
                {saved ? <Check size={15} /> : <Save size={15} />}
                {saving
                  ? "Salvando..."
                  : saved
                    ? "Salvo"
                    : "Salvar conferência"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Responsável padrão">
                <input
                  className={INPUT_CLASS}
                  value={form.responsible ?? ""}
                  onChange={(event) =>
                    updateForm("responsible", event.target.value || null)
                  }
                  placeholder="Ex.: Tai"
                />
              </Field>
              <Field label="Prioridade operacional">
                <select
                  className={INPUT_CLASS}
                  value={form.priority}
                  onChange={(event) =>
                    updateForm(
                      "priority",
                      event.target.value as ReadinessPriority,
                    )
                  }
                >
                  {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                    <option key={value} value={value} className="bg-slate-950">
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sociedade de cadastro da obra">
                <input
                  className={INPUT_CLASS}
                  value={form.work_registration_society ?? ""}
                  onChange={(event) =>
                    updateForm(
                      "work_registration_society",
                      event.target.value || null,
                    )
                  }
                  placeholder="Abramus, UBC..."
                />
              </Field>
              <Field label="Distribuidora">
                <input
                  className={INPUT_CLASS}
                  value={form.distributor ?? ""}
                  onChange={(event) =>
                    updateForm("distributor", event.target.value || null)
                  }
                  placeholder="Ex.: Symphonic"
                />
              </Field>
              <Field label="P-line">
                <input
                  className={INPUT_CLASS}
                  value={form.p_line ?? ""}
                  onChange={(event) =>
                    updateForm("p_line", event.target.value || null)
                  }
                  placeholder="℗ 2026 Selo"
                />
              </Field>
              <Field label="C-line">
                <input
                  className={INPUT_CLASS}
                  value={form.c_line ?? ""}
                  onChange={(event) =>
                    updateForm("c_line", event.target.value || null)
                  }
                  placeholder="© 2026 Selo"
                />
              </Field>
              <Field label="Master owner">
                <input
                  className={INPUT_CLASS}
                  value={form.master_owner ?? ""}
                  onChange={(event) =>
                    updateForm("master_owner", event.target.value || null)
                  }
                  placeholder="Proprietário da master"
                />
              </Field>
              <Field label="Comissão do selo (%)">
                <input
                  className={INPUT_CLASS}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.label_commission_percentage ?? ""}
                  onChange={(event) =>
                    updateForm(
                      "label_commission_percentage",
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                  placeholder="20"
                />
              </Field>
              <Field label="Regra de pagamento">
                <input
                  className={INPUT_CLASS}
                  value={form.payment_rule ?? ""}
                  onChange={(event) =>
                    updateForm("payment_rule", event.target.value || null)
                  }
                  placeholder="Mensal, mínimo de saque..."
                />
              </Field>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Toggle
                label="Obra cadastrada"
                checked={form.work_registered}
                onChange={(value) => updateForm("work_registered", value)}
              />
              <Toggle
                label="Comprovante conferido"
                checked={form.work_registration_proof_attached}
                onChange={(value) =>
                  updateForm("work_registration_proof_attached", value)
                }
              />
              <Toggle
                label="WAV aprovado"
                checked={form.wav_approved}
                onChange={(value) => updateForm("wav_approved", value)}
              />
              <Toggle
                label="Capa aprovada"
                checked={form.cover_approved}
                onChange={(value) => updateForm("cover_approved", value)}
              />
              <Toggle
                label="Dados de pagamento conferidos"
                checked={form.payment_data_confirmed}
                onChange={(value) =>
                  updateForm("payment_data_confirmed", value)
                }
              />
              <Toggle
                label="Contratos aprovados"
                checked={form.contracts_approved}
                onChange={(value) => updateForm("contracts_approved", value)}
              />
              <Toggle
                label="Contrato do feat aprovado"
                checked={form.featured_contract_approved}
                onChange={(value) =>
                  updateForm("featured_contract_approved", value)
                }
              />
              <Toggle
                label="Release criado na distribuidora"
                checked={form.symphonic_release_created}
                onChange={(value) =>
                  updateForm("symphonic_release_created", value)
                }
              />
              <Toggle
                label="Entregue para lojas"
                checked={form.delivered_to_stores}
                onChange={(value) => updateForm("delivered_to_stores", value)}
              />
              <Toggle
                label="Publicado"
                checked={form.published}
                onChange={(value) => updateForm("published", value)}
              />
            </div>

            <Field label="Notas operacionais">
              <textarea
                className="placeholder:text-white/28 mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 text-sm text-white outline-none focus:border-sky-300/30"
                value={form.notes ?? ""}
                onChange={(event) =>
                  updateForm("notes", event.target.value || null)
                }
                placeholder="Contexto para a equipe..."
              />
            </Field>
          </form>

          <div className="space-y-4">
            <form
              onSubmit={createTask}
              className="rounded-[26px] border border-white/10 bg-white/[0.025] p-4 sm:p-5"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-sky-200" />
                <h3 className="text-base font-semibold text-white">
                  Nova tarefa
                </h3>
              </div>
              <div className="mt-4 space-y-3">
                <Field label="Ação necessária">
                  <input
                    className={INPUT_CLASS}
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    placeholder="Ex.: cadastrar obra na Abramus"
                    required
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Área">
                    <select
                      className={INPUT_CLASS}
                      value={taskArea}
                      onChange={(event) =>
                        setTaskArea(event.target.value as ReadinessAreaKey)
                      }
                    >
                      {READINESS_AREAS.map((area) => (
                        <option
                          key={area}
                          value={area}
                          className="bg-slate-950"
                        >
                          {READINESS_AREA_LABELS[area]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Prioridade">
                    <select
                      className={INPUT_CLASS}
                      value={taskPriority}
                      onChange={(event) =>
                        setTaskPriority(event.target.value as ReadinessPriority)
                      }
                    >
                      {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                        <option
                          key={value}
                          value={value}
                          className="bg-slate-950"
                        >
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Responsável">
                    <input
                      className={INPUT_CLASS}
                      value={taskResponsible}
                      onChange={(event) =>
                        setTaskResponsible(event.target.value)
                      }
                      placeholder="Ex.: Tai"
                    />
                  </Field>
                  <Field label="Prazo">
                    <input
                      className={INPUT_CLASS}
                      type="date"
                      value={taskDueDate}
                      onChange={(event) => setTaskDueDate(event.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <button
                type="submit"
                disabled={taskSaving || !taskTitle.trim()}
                className="border-white/12 mt-4 inline-flex h-10 items-center gap-2 rounded-full border bg-white/[0.07] px-4 text-sm font-medium text-white transition hover:bg-white/[0.11] disabled:opacity-40"
              >
                <Plus size={15} /> {taskSaving ? "Criando..." : "Criar tarefa"}
              </button>
            </form>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">
                  Ordem de serviço
                </h3>
                <span className="text-white/48 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs">
                  {tasks.length} tarefas
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {tasks.length > 0 ? (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "rounded-[20px] border p-3",
                        task.status === "done"
                          ? "border-emerald-300/10 bg-emerald-300/[0.045]"
                          : "border-white/10 bg-white/[0.03]",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            updateTask(
                              task.id,
                              task.status === "done" ? "todo" : "done",
                            )
                          }
                          aria-label={
                            task.status === "done"
                              ? "Reabrir tarefa"
                              : "Concluir tarefa"
                          }
                          className="mt-0.5 text-white/50 transition hover:text-emerald-200"
                        >
                          {task.status === "done" ? (
                            <CheckCircle2
                              size={17}
                              className="text-emerald-300"
                            />
                          ) : (
                            <Circle size={17} />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              "text-sm font-medium",
                              task.status === "done"
                                ? "text-white/46 line-through"
                                : "text-white",
                            )}
                          >
                            {task.title}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/40">
                            <span>{READINESS_AREA_LABELS[task.area]}</span>
                            <span>{PRIORITY_LABEL[task.priority]}</span>
                            <span>{task.responsible || "Sem responsável"}</span>
                            {task.due_date ? (
                              <span>
                                {new Date(
                                  `${task.due_date}T12:00:00`,
                                ).toLocaleDateString("pt-BR")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteTask(task.id)}
                          aria-label="Excluir tarefa"
                          className="text-white/24 transition hover:text-rose-300"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      {task.status !== "done" ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateTask(
                              task.id,
                              task.status === "in_progress"
                                ? "todo"
                                : "in_progress",
                            )
                          }
                          className="text-white/46 mt-3 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium transition hover:text-white"
                        >
                          {TASK_STATUS_LABEL[task.status]} ·{" "}
                          {task.status === "in_progress"
                            ? "voltar para fila"
                            : "iniciar"}
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="text-white/38 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm">
                    Nenhuma tarefa criada.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
