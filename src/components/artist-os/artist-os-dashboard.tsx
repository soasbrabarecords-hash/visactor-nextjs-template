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
      card: "border-emerald-200/35 bg-[radial-gradient(circle_at_85%_12%,rgba(110,231,183,0.34),transparent_32%),linear-gradient(135deg,rgba(6,95,70,0.92),rgba(5,46,22,0.80)_52%,rgba(15,23,42,0.88))]",
      icon: "border-emerald-100/35 bg-emerald-200/20 text-emerald-50",
      rail: "from-emerald-200 via-lime-300 to-emerald-400",
      label: "text-emerald-50/76",
      helper: "text-emerald-50/78",
      glow: "bg-emerald-300/24",
    },
    sky: {
      card: "border-sky-200/35 bg-[radial-gradient(circle_at_85%_12%,rgba(125,211,252,0.34),transparent_32%),linear-gradient(135deg,rgba(3,105,161,0.92),rgba(12,74,110,0.78)_52%,rgba(15,23,42,0.88))]",
      icon: "border-sky-100/35 bg-sky-200/20 text-sky-50",
      rail: "from-sky-200 via-cyan-300 to-blue-400",
      label: "text-sky-50/76",
      helper: "text-sky-50/78",
      glow: "bg-sky-300/24",
    },
    amber: {
      card: "border-amber-200/38 bg-[radial-gradient(circle_at_85%_12%,rgba(253,230,138,0.38),transparent_32%),linear-gradient(135deg,rgba(180,83,9,0.92),rgba(120,53,15,0.80)_52%,rgba(15,23,42,0.88))]",
      icon: "border-amber-100/35 bg-amber-200/20 text-amber-50",
      rail: "from-amber-100 via-yellow-300 to-orange-400",
      label: "text-amber-50/80",
      helper: "text-amber-50/80",
      glow: "bg-amber-300/24",
    },
    rose: {
      card: "border-rose-200/38 bg-[radial-gradient(circle_at_85%_12%,rgba(253,164,175,0.34),transparent_32%),linear-gradient(135deg,rgba(190,18,60,0.92),rgba(127,29,29,0.82)_52%,rgba(15,23,42,0.88))]",
      icon: "border-rose-100/35 bg-rose-200/20 text-rose-50",
      rail: "from-rose-100 via-red-300 to-orange-400",
      label: "text-rose-50/78",
      helper: "text-rose-50/78",
      glow: "bg-rose-300/24",
    },
    violet: {
      card: "border-violet-200/35 bg-[radial-gradient(circle_at_85%_12%,rgba(196,181,253,0.32),transparent_32%),linear-gradient(135deg,rgba(109,40,217,0.90),rgba(76,29,149,0.78)_52%,rgba(15,23,42,0.88))]",
      icon: "border-violet-100/35 bg-violet-200/20 text-violet-50",
      rail: "from-violet-100 via-fuchsia-300 to-violet-500",
      label: "text-violet-50/78",
      helper: "text-violet-50/78",
      glow: "bg-violet-300/22",
    },
    cyan: {
      card: "border-cyan-200/35 bg-[radial-gradient(circle_at_85%_12%,rgba(103,232,249,0.32),transparent_32%),linear-gradient(135deg,rgba(14,116,144,0.90),rgba(21,94,117,0.78)_52%,rgba(15,23,42,0.88))]",
      icon: "border-cyan-100/35 bg-cyan-200/20 text-cyan-50",
      rail: "from-cyan-100 via-teal-300 to-emerald-400",
      label: "text-cyan-50/78",
      helper: "text-cyan-50/78",
      glow: "bg-cyan-300/22",
    },
    slate: {
      card: "border-slate-200/22 bg-[radial-gradient(circle_at_85%_12%,rgba(203,213,225,0.18),transparent_32%),linear-gradient(135deg,rgba(51,65,85,0.82),rgba(30,41,59,0.76)_52%,rgba(15,23,42,0.90))]",
      icon: "border-white/18 bg-white/[0.10] text-white",
      rail: "from-white/70 via-slate-300/60 to-slate-500",
      label: "text-white/68",
      helper: "text-white/64",
      glow: "bg-white/12",
    },
  } as const;
  const toneConfig = tones[tone];

  return (
    <article
      className={cn(
        "group relative min-h-[150px] overflow-hidden rounded-[30px] border p-4 shadow-[0_24px_95px_-58px_rgba(0,0,0,0.95)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_105px_-58px_rgba(0,0,0,0.95)]",
        toneConfig.card,
      )}
    >
      <div className={cn("absolute inset-y-4 left-0 w-1 rounded-r-full bg-gradient-to-b", toneConfig.rail)} />
      <div className={cn("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl", toneConfig.glow)} />
      <div className={cn("absolute inset-x-5 top-0 h-px bg-gradient-to-r", toneConfig.rail)} />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className={cn("text-[10px] font-black uppercase tracking-[0.18em]", toneConfig.label)}>
            {label}
          </div>
          <div className="mt-3 text-4xl font-black tracking-[-0.055em] text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.35)]">
            {value}
          </div>
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border shadow-inner backdrop-blur", toneConfig.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className={cn("relative mt-4 text-sm font-black leading-5", toneConfig.helper)}>
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
    emerald: "border-emerald-200/24 bg-[radial-gradient(circle_at_top_right,rgba(110,231,183,0.18),transparent_34%),linear-gradient(145deg,rgba(6,78,59,0.54),rgba(15,23,42,0.84)_66%)]",
    sky: "border-sky-200/24 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.18),transparent_34%),linear-gradient(145deg,rgba(12,74,110,0.56),rgba(15,23,42,0.84)_66%)]",
    amber: "border-amber-200/26 bg-[radial-gradient(circle_at_top_right,rgba(253,230,138,0.20),transparent_34%),linear-gradient(145deg,rgba(120,53,15,0.56),rgba(15,23,42,0.84)_66%)]",
    rose: "border-rose-200/26 bg-[radial-gradient(circle_at_top_right,rgba(253,164,175,0.18),transparent_34%),linear-gradient(145deg,rgba(127,29,29,0.56),rgba(15,23,42,0.84)_66%)]",
    violet: "border-violet-200/24 bg-[radial-gradient(circle_at_top_right,rgba(196,181,253,0.18),transparent_34%),linear-gradient(145deg,rgba(76,29,149,0.54),rgba(15,23,42,0.84)_66%)]",
    cyan: "border-cyan-200/24 bg-[radial-gradient(circle_at_top_right,rgba(103,232,249,0.18),transparent_34%),linear-gradient(145deg,rgba(21,94,117,0.54),rgba(15,23,42,0.84)_66%)]",
    slate: "border-white/12 bg-[linear-gradient(145deg,rgba(51,65,85,0.38),rgba(15,23,42,0.86)_66%)]",
  } as const;

  return (
    <section
      className={cn(
        "rounded-[30px] border p-4 shadow-[0_20px_80px_-60px_rgba(0,0,0,0.95)]",
        tones[tone],
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-black tracking-[-0.02em] text-white">{title}</h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-white/55 transition hover:border-white/20 hover:text-white"
        >
          Abrir
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/12 bg-black/24 p-5 text-sm font-semibold text-white/50">
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
    <div className="rounded-[20px] border border-white/10 bg-black/20 px-3 py-3 transition hover:border-white/18 hover:bg-white/[0.055]">
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
        <div className="flex items-start gap-3 rounded-[24px] border border-amber-300/20 bg-amber-300/[0.08] p-4 text-amber-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="text-sm font-black">ArtistOS em modo demo</div>
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
                  <div className="truncate text-sm font-black text-white">{String(show.event_name ?? "Show")}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {String(show.city ?? "Cidade aberta")} · {dateLabel(show.event_date)}
                  </div>
                </div>
                <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/55">
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
                  <div className="text-sm font-black text-white">{String(deal.contact_name ?? "Contato")}</div>
                  <div className="mt-1 text-xs text-white/45">{String(deal.event_type ?? "Evento")}</div>
                </div>
                <div className="text-sm font-bold text-white/70">{money(deal.estimated_budget)}</div>
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
                  <div className="text-sm font-black text-white">{String(row.description ?? "Movimentação")}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {String(row.category ?? "categoria")} · {String(row.status ?? "previsto")}
                  </div>
                </div>
                <div
                  className={cn(
                    "text-sm font-black",
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
                  <div className="text-sm font-black text-white">{String(task.title ?? "Tarefa")}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {String(task.assignee ?? "Sem responsável")} · {dateLabel(task.due_at)}
                  </div>
                </div>
                <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/55">
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
