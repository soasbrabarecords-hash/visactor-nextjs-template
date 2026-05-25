import Link from "next/link";
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
  tone: "emerald" | "sky" | "amber" | "rose" | "slate";
  icon: typeof CalendarDays;
}) {
  const tones = {
    emerald: "border-emerald-300/16 bg-emerald-300/[0.08] text-emerald-100",
    sky: "border-sky-300/16 bg-sky-300/[0.08] text-sky-100",
    amber: "border-amber-300/18 bg-amber-300/[0.09] text-amber-100",
    rose: "border-rose-300/18 bg-rose-300/[0.08] text-rose-100",
    slate: "border-white/10 bg-white/[0.045] text-white",
  } as const;

  return (
    <article className={cn("rounded-[26px] border p-4 shadow-[0_18px_70px_-52px_rgba(0,0,0,0.9)]", tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
            {label}
          </div>
          <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
            {value}
          </div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm font-medium leading-5 text-white/52">{helper}</p>
    </article>
  );
}

function ListCard({
  title,
  href,
  rows,
  empty,
  render,
}: {
  title: string;
  href: string;
  rows: ArtistOsRecord[];
  empty: string;
  render: (row: ArtistOsRecord) => React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_20px_80px_-60px_rgba(0,0,0,0.9)]">
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
        <div className="rounded-[22px] border border-dashed border-white/10 bg-black/20 p-5 text-sm font-medium text-white/42">
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
          tone: "sky",
          icon: Clock3,
        })}
        {metricCard({
          label: "Receita prevista",
          value: money(expectedRevenue),
          helper: "Entradas previstas e recebidas.",
          tone: "emerald",
          icon: BadgeDollarSign,
        })}
        {metricCard({
          label: "Caixa disponível",
          value: money(cash),
          helper: "Recebido menos saídas lançadas.",
          tone: cash >= 0 ? "slate" : "rose",
          icon: Wallet,
        })}
        {metricCard({
          label: "Publicidade",
          value: brandActive.length,
          helper: "Campanhas em andamento.",
          tone: "amber",
          icon: Megaphone,
        })}
        {metricCard({
          label: "Tarefas pendentes",
          value: pendingTasks.length,
          helper: `${urgentTasks.length} urgentes agora.`,
          tone: urgentTasks.length > 0 ? "rose" : "slate",
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
