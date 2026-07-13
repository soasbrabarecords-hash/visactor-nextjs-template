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
import Link from "next/link";
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
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
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
      card: "border-emerald-500/15 bg-card/80",
      icon: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
      accent: "text-emerald-700 dark:text-emerald-200",
      helper: "text-muted-foreground",
    },
    sky: {
      card: "border-sky-500/15 bg-card/80",
      icon: "bg-sky-500/10 text-sky-700 dark:text-sky-200",
      accent: "text-sky-700 dark:text-sky-200",
      helper: "text-muted-foreground",
    },
    amber: {
      card: "border-amber-500/15 bg-card/80",
      icon: "bg-amber-500/10 text-amber-700 dark:text-amber-200",
      accent: "text-amber-700 dark:text-amber-200",
      helper: "text-muted-foreground",
    },
    rose: {
      card: "border-rose-500/15 bg-card/80",
      icon: "bg-rose-500/10 text-rose-700 dark:text-rose-200",
      accent: "text-rose-700 dark:text-rose-200",
      helper: "text-muted-foreground",
    },
    violet: {
      card: "border-violet-500/15 bg-card/80",
      icon: "bg-violet-500/10 text-violet-700 dark:text-violet-200",
      accent: "text-violet-700 dark:text-violet-200",
      helper: "text-muted-foreground",
    },
    cyan: {
      card: "border-cyan-500/15 bg-card/80",
      icon: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
      accent: "text-cyan-700 dark:text-cyan-200",
      helper: "text-muted-foreground",
    },
    slate: {
      card: "border-border/70 bg-card/80",
      icon: "bg-muted text-foreground/75",
      accent: "text-foreground/80",
      helper: "text-muted-foreground",
    },
  } as const;
  const toneConfig = tones[tone];

  return (
    <article
      className={cn(
        "relative min-h-[124px] overflow-hidden rounded-2xl border p-4 shadow-sm transition-colors duration-150 hover:border-border",
        toneConfig.card,
      )}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div
            className={cn(
              "text-sm font-medium tracking-[-0.01em]",
              toneConfig.accent,
            )}
          >
            {label}
          </div>
          <div className="mt-2.5 text-3xl font-semibold tracking-[-0.045em] text-foreground">
            {value}
          </div>
        </div>
        <div
          className={cn(
            "ring-current/10 flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset",
            toneConfig.icon,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p
        className={cn(
          "relative mt-3 text-sm font-normal leading-5",
          toneConfig.helper,
        )}
      >
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
    emerald: "border-emerald-500/15 bg-card/80",
    sky: "border-sky-500/15 bg-card/80",
    amber: "border-amber-500/15 bg-card/80",
    rose: "border-rose-500/15 bg-card/80",
    violet: "border-violet-500/15 bg-card/80",
    cyan: "border-cyan-500/15 bg-card/80",
    slate: "border-border/70 bg-card/80",
  } as const;

  return (
    <section className={cn("rounded-2xl border p-4 shadow-sm", tones[tone])}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
          {title}
        </h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          Abrir
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm font-medium text-muted-foreground">
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
    <div className="rounded-xl border border-border bg-background px-3 py-3 transition-colors hover:bg-muted/50">
      {children}
    </div>
  );
}

export default function ArtistOsDashboard({
  data,
}: {
  data: ArtistOsDashboardData;
}) {
  const confirmedShows = data.shows.filter(
    (show) =>
      isCurrentMonth(show.event_date) &&
      [
        "fechado",
        "sinal_pago",
        "em_execucao",
        "realizado",
        "pago_final",
      ].includes(String(show.status)),
  );
  const negotiatingShows = data.shows.filter((show) =>
    ["lead", "proposta_enviada", "negociando"].includes(String(show.status)),
  );
  const brandActive = data.brandDeals.filter((deal) =>
    ["aprovado", "contrato", "producao", "publicado", "comprovado"].includes(
      String(deal.status),
    ),
  );
  const pendingTasks = data.tasks.filter(
    (task) => !["concluida", "cancelada"].includes(String(task.status)),
  );
  const urgentTasks = data.tasks.filter(
    (task) => String(task.priority) === "urgente",
  );
  const openPayments = data.finance.filter((row) =>
    ["previsto", "atrasado"].includes(String(row.status)),
  );
  const expectedRevenue = data.finance
    .filter(
      (row) => row.transaction_type === "entrada" && row.status !== "cancelado",
    )
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const received = data.finance
    .filter(
      (row) => row.transaction_type === "entrada" && row.status === "recebido",
    )
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const expenses = data.finance
    .filter(
      (row) => row.transaction_type === "saida" && row.status !== "cancelado",
    )
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
        <div className="flex items-start gap-3 rounded-[22px] border border-amber-500/20 bg-amber-500/[0.08] p-4 text-amber-800 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="text-sm font-semibold">
              Business OS em modo demo
            </div>
            <p className="mt-1 text-sm text-amber-800/75 dark:text-amber-200/75">
              A migration ainda precisa ser aplicada no Supabase para gravar
              dados reais.
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
          tone: openPayments.some((row) => row.status === "atrasado")
            ? "rose"
            : "amber",
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
                  <div className="truncate text-sm font-medium text-foreground">
                    {String(show.event_name ?? "Show")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {String(show.city ?? "Cidade aberta")} ·{" "}
                    {dateLabel(show.event_date)}
                  </div>
                </div>
                <div className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
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
                  <div className="text-sm font-medium text-foreground">
                    {String(deal.contact_name ?? "Contato")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {String(deal.event_type ?? "Evento")}
                  </div>
                </div>
                <div className="text-sm font-medium text-foreground/75">
                  {money(deal.estimated_budget)}
                </div>
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
                  <div className="text-sm font-medium text-foreground">
                    {String(row.description ?? "Movimentação")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {String(row.category ?? "categoria")} ·{" "}
                    {String(row.status ?? "previsto")}
                  </div>
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold",
                    row.transaction_type === "saida"
                      ? "text-rose-700 dark:text-rose-300"
                      : "text-emerald-700 dark:text-emerald-300",
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
                  <div className="text-sm font-medium text-foreground">
                    {String(task.title ?? "Tarefa")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {String(task.assignee ?? "Sem responsável")} ·{" "}
                    {dateLabel(task.due_at)}
                  </div>
                </div>
                <div className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
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
