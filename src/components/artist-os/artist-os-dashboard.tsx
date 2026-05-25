import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowRight,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Megaphone,
  Wallet,
} from "lucide-react";
import type { ArtistOsDashboardData } from "@/lib/artist-os";
import type { ArtistOsRecord } from "@/lib/artist-os-types";
import { cn } from "@/lib/utils";

function money(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function dateLabel(value: unknown) {
  if (!value) return "Sem data";
  return new Date(String(value)).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function toNumber(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function isCurrentMonth(value: unknown) {
  if (!value) return false;
  const date = new Date(String(value));
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function metricCard({
  label,
  value,
  helper,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone: "emerald" | "sky" | "amber" | "rose" | "violet" | "cyan" | "slate";
  icon: LucideIcon;
}) {
  const tones = {
    emerald: {
      card: "bg-[linear-gradient(145deg,rgba(16,185,129,0.24),rgba(15,23,42,0.94)_62%)] text-emerald-50",
      icon: "bg-emerald-400/14 text-emerald-100 ring-1 ring-inset ring-emerald-200/14",
      accent: "text-emerald-100",
      helper: "text-emerald-50/72",
    },
    sky: {
      card: "bg-[linear-gradient(145deg,rgba(14,165,233,0.24),rgba(15,23,42,0.94)_62%)] text-sky-50",
      icon: "bg-sky-400/14 text-sky-100 ring-1 ring-inset ring-sky-200/14",
      accent: "text-sky-100",
      helper: "text-sky-50/72",
    },
    amber: {
      card: "bg-[linear-gradient(145deg,rgba(245,158,11,0.26),rgba(15,23,42,0.94)_62%)] text-amber-50",
      icon: "bg-amber-400/14 text-amber-100 ring-1 ring-inset ring-amber-200/14",
      accent: "text-amber-100",
      helper: "text-amber-50/74",
    },
    rose: {
      card: "bg-[linear-gradient(145deg,rgba(244,63,94,0.24),rgba(15,23,42,0.94)_62%)] text-rose-50",
      icon: "bg-rose-400/14 text-rose-100 ring-1 ring-inset ring-rose-200/14",
      accent: "text-rose-100",
      helper: "text-rose-50/72",
    },
    violet: {
      card: "bg-[linear-gradient(145deg,rgba(139,92,246,0.24),rgba(15,23,42,0.94)_62%)] text-violet-50",
      icon: "bg-violet-400/14 text-violet-100 ring-1 ring-inset ring-violet-200/14",
      accent: "text-violet-100",
      helper: "text-violet-50/72",
    },
    cyan: {
      card: "bg-[linear-gradient(145deg,rgba(6,182,212,0.24),rgba(15,23,42,0.94)_62%)] text-cyan-50",
      icon: "bg-cyan-400/14 text-cyan-100 ring-1 ring-inset ring-cyan-200/14",
      accent: "text-cyan-100",
      helper: "text-cyan-50/72",
    },
    slate: {
      card: "bg-[linear-gradient(145deg,rgba(100,116,139,0.18),rgba(15,23,42,0.94)_62%)] text-white",
      icon: "bg-white/[0.08] text-white/82 ring-1 ring-inset ring-white/10",
      accent: "text-white/82",
      helper: "text-white/60",
    },
  } as const;
  const toneConfig = tones[tone];

  return (
    <article
      className={cn(
        "relative min-h-[140px] overflow-hidden rounded-[28px] p-4 shadow-[0_18px_70px_-56px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/[0.07] transition duration-300 hover:-translate-y-0.5 hover:ring-white/12",
        toneConfig.card,
      )}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className={cn("text-sm font-medium tracking-[-0.01em]", toneConfig.accent)}>
            {label}
          </div>
          <div className="mt-3 text-4xl font-semibold tracking-[-0.055em] text-white">
            {value}
          </div>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl backdrop-blur", toneConfig.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className={cn("relative mt-4 text-sm font-medium leading-5", toneConfig.helper)}>
        {helper}
      </p>
    </article>
  );
}

function ListCard({
  title,
  href,
  rows,
  empty,
  render,
  tone = "slate",
}: {
  title: string;
  href: string;
  rows: ArtistOsRecord[];
  empty: string;
  render: (row: ArtistOsRecord) => React.ReactNode;
  tone?: "emerald" | "sky" | "amber" | "rose" | "violet" | "cyan" | "slate";
}) {
  const tones = {
    emerald: "bg-[linear-gradient(145deg,rgba(16,185,129,0.16),rgba(15,23,42,0.94)_68%)]",
    sky: "bg-[linear-gradient(145deg,rgba(14,165,233,0.16),rgba(15,23,42,0.94)_68%)]",
    amber: "bg-[linear-gradient(145deg,rgba(245,158,11,0.17),rgba(15,23,42,0.94)_68%)]",
    rose: "bg-[linear-gradient(145deg,rgba(244,63,94,0.16),rgba(15,23,42,0.94)_68%)]",
    violet: "bg-[linear-gradient(145deg,rgba(139,92,246,0.16),rgba(15,23,42,0.94)_68%)]",
    cyan: "bg-[linear-gradient(145deg,rgba(6,182,212,0.16),rgba(15,23,42,0.94)_68%)]",
    slate: "bg-[linear-gradient(145deg,rgba(100,116,139,0.12),rgba(15,23,42,0.94)_68%)]",
  } as const;

  return (
    <section
      className={cn(
        "rounded-[28px] p-4 shadow-[0_18px_70px_-58px_rgba(0,0,0,0.88)] ring-1 ring-inset ring-white/[0.07]",
        tones[tone],
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-white/92">{title}</h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-white/64 transition hover:bg-white/[0.11] hover:text-white"
        >
          Abrir
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[22px] bg-black/20 p-5 text-sm font-medium text-white/56 ring-1 ring-inset ring-white/[0.06]">
          {empty}
        </div>
      ) : (
        <div className="space-y-2">{rows.slice(0, 5).map(render)}</div>
      )}
    </section>
  );
}

function RowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] bg-black/20 px-3 py-3 ring-1 ring-inset ring-white/[0.06] transition hover:bg-white/[0.055]">
      {children}
    </div>
  );
}

export default function ArtistOsDashboard({ data }: { data: ArtistOsDashboardData }) {
  const confirmedShows = data.shows.filter(
    (show) =>
      isCurrentMonth(show.event_date) &&
      ["fechado", "sinal_pago", "em_execucao", "realizado", "pago_final"].includes(String(show.status)),
  );
  const negotiatingShows = data.shows.filter((show) =>
    ["lead", "proposta_enviada", "negociando"].includes(String(show.status)),
  );
  const brandActive = data.brandDeals.filter((deal) =>
    ["aprovado", "contrato", "producao", "publicado", "comprovado"].includes(String(deal.status)),
  );
  const pendingTasks = data.tasks.filter((task) => !["concluida", "cancelada"].includes(String(task.status)));
  const urgentTasks = data.tasks.filter((task) => String(task.priority) === "urgente");
  const openPayments = data.finance.filter((row) => ["previsto", "atrasado"].includes(String(row.status)));
  const expectedRevenue = data.finance
    .filter((row) => row.transaction_type === "entrada" && row.status !== "cancelado")
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const received = data.finance
    .filter((row) => row.transaction_type === "entrada" && row.status === "recebido")
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const expenses = data.finance
    .filter((row) => row.transaction_type === "saida" && row.status !== "cancelado")
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const cash = received - expenses;

  const nextShows = [...data.shows]
    .filter((show) => show.event_date)
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));
  const latestDeals = [...data.deals].slice(0, 5);
  const latestFinance = [...data.finance].slice(0, 5);

  return (
    <div className="space-y-5">
      {!data.tableReady ? (
        <div className="flex items-start gap-3 rounded-[24px] bg-amber-300/[0.08] p-4 text-amber-100 ring-1 ring-inset ring-amber-200/12">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="text-sm font-semibold">ArtistOS em modo demo</div>
            <p className="mt-1 text-sm text-amber-100/70">
              A migration ainda precisa ser aplicada no Supabase para gravar dados reais.
            </p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metricCard({
          label: "Shows confirmados",
          value: confirmedShows.length,
          helper: "Fechados no mês atual.",
          tone: "emerald",
          icon: CalendarDays,
        })}
        {metricCard({
          label: "Em negociação",
          value: negotiatingShows.length,
          helper: "Leads e propostas abertas.",
          tone: "amber",
          icon: Clock3,
        })}
        {metricCard({
          label: "Receita prevista",
          value: money(expectedRevenue),
          helper: "Entradas previstas e recebidas.",
          tone: "cyan",
          icon: BadgeDollarSign,
        })}
        {metricCard({
          label: "Caixa disponível",
          value: money(cash),
          helper: "Recebido menos saídas lançadas.",
          tone: cash >= 0 ? "sky" : "rose",
          icon: Wallet,
        })}
        {metricCard({
          label: "Publicidade",
          value: brandActive.length,
          helper: "Campanhas em andamento.",
          tone: "violet",
          icon: Megaphone,
        })}
        {metricCard({
          label: "Tarefas pendentes",
          value: pendingTasks.length,
          helper: `${urgentTasks.length} urgentes agora.`,
          tone: "rose",
          icon: CheckCircle2,
        })}
        {metricCard({
          label: "Compromissos",
          value: nextShows.length,
          helper: "Shows com data cadastrada.",
          tone: "sky",
          icon: CalendarDays,
        })}
        {metricCard({
          label: "Pagamentos abertos",
          value: openPayments.length,
          helper: "Previstos ou atrasados.",
          tone: openPayments.some((row) => row.status === "atrasado") ? "rose" : "amber",
          icon: AlertCircle,
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ListCard
          title="Próximos shows"
          href="/artist-os/shows"
          rows={nextShows}
          empty="Nenhum show cadastrado ainda."
          tone="sky"
          render={(show) => (
            <RowShell key={show.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white/92">{String(show.event_name ?? "Show")}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {String(show.city ?? "Cidade aberta")} · {dateLabel(show.event_date)}
                  </div>
                </div>
                <div className="rounded-full bg-white/[0.07] px-2 py-1 text-xs font-medium text-white/60">
                  {String(show.status ?? "lead").replaceAll("_", " ")}
                </div>
              </div>
            </RowShell>
          )}
        />

        <ListCard
          title="Últimas negociações"
          href="/artist-os/deals"
          rows={latestDeals}
          empty="Nenhuma negociação no pipeline."
          tone="amber"
          render={(deal) => (
            <RowShell key={deal.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white/92">{String(deal.contact_name ?? "Contato")}</div>
                  <div className="mt-1 text-xs text-white/45">{String(deal.event_type ?? "Evento")}</div>
                </div>
                <div className="text-sm font-medium text-white/70">{money(deal.estimated_budget)}</div>
              </div>
            </RowShell>
          )}
        />

        <ListCard
          title="Movimentações financeiras"
          href="/artist-os/finance"
          rows={latestFinance}
          empty="Nenhuma movimentação financeira."
          tone="cyan"
          render={(row) => (
            <RowShell key={row.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white/92">{String(row.description ?? "Movimentação")}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {String(row.category ?? "categoria")} · {String(row.status ?? "previsto")}
                  </div>
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold",
                    row.transaction_type === "saida" ? "text-rose-200" : "text-emerald-200",
                  )}
                >
                  {row.transaction_type === "saida" ? "-" : "+"}
                  {money(row.amount)}
                </div>
              </div>
            </RowShell>
          )}
        />

        <ListCard
          title="Tarefas urgentes"
          href="/artist-os/tasks"
          rows={urgentTasks.length > 0 ? urgentTasks : pendingTasks}
          empty="Nenhuma tarefa pendente."
          tone="rose"
          render={(task) => (
            <RowShell key={task.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white/92">{String(task.title ?? "Tarefa")}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {String(task.assignee ?? "Sem responsável")} · {dateLabel(task.due_at)}
                  </div>
                </div>
                <div className="rounded-full bg-white/[0.07] px-2 py-1 text-xs font-medium text-white/60">
                  {String(task.priority ?? "media")}
                </div>
              </div>
            </RowShell>
          )}
        />
      </section>
    </div>
  );
}
