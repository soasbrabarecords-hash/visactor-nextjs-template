import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  FileSignature,
  Megaphone,
  Settings2,
  UsersRound,
} from "lucide-react";

export type ArtistOsResourceKey =
  | "artists"
  | "shows"
  | "deals"
  | "brand-deals"
  | "finance"
  | "contracts"
  | "tasks";

export type ArtistOsSectionKey = ArtistOsResourceKey | "reports" | "settings";

export type ArtistOsFieldType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "time"
  | "textarea"
  | "select"
  | "checkbox"
  | "artist";

export type ArtistOsFieldOption = {
  label: string;
  value: string;
};

export type ArtistOsFieldConfig = {
  key: string;
  label: string;
  type: ArtistOsFieldType;
  placeholder?: string;
  required?: boolean;
  options?: ArtistOsFieldOption[];
  span?: "full";
};

export type ArtistOsColumnConfig = {
  key: string;
  label: string;
  type?: "text" | "money" | "date" | "datetime" | "status" | "artist" | "boolean";
};

export type ArtistOsFilterConfig = {
  key: string;
  label: string;
  type: "select" | "artist" | "month";
  options?: ArtistOsFieldOption[];
};

export type ArtistOsResourceConfig = {
  key: ArtistOsResourceKey;
  table: string;
  title: string;
  eyebrow: string;
  description: string;
  singular: string;
  newLabel: string;
  icon: LucideIcon;
  primaryField: string;
  secondaryField?: string;
  statusField?: string;
  searchFields: string[];
  fields: ArtistOsFieldConfig[];
  columns: ArtistOsColumnConfig[];
  filters: ArtistOsFilterConfig[];
};

export type ArtistOsSectionConfig = {
  key: ArtistOsSectionKey | "overview";
  label: string;
  href: string;
  icon: LucideIcon;
};

export const artistTypeOptions: ArtistOsFieldOption[] = [
  { label: "Artista", value: "artista" },
  { label: "DJ", value: "dj" },
  { label: "Produtor", value: "produtor" },
  { label: "Influenciador", value: "influenciador" },
  { label: "Banda", value: "banda" },
];

export const artistStatusOptions: ArtistOsFieldOption[] = [
  { label: "Ativo", value: "ativo" },
  { label: "Pausado", value: "pausado" },
  { label: "Arquivado", value: "arquivado" },
];

export const showStatusOptions: ArtistOsFieldOption[] = [
  { label: "Lead", value: "lead" },
  { label: "Proposta enviada", value: "proposta_enviada" },
  { label: "Negociando", value: "negociando" },
  { label: "Fechado", value: "fechado" },
  { label: "Sinal pago", value: "sinal_pago" },
  { label: "Em execução", value: "em_execucao" },
  { label: "Realizado", value: "realizado" },
  { label: "Pago final", value: "pago_final" },
  { label: "Cancelado", value: "cancelado" },
];

export const dealStatusOptions: ArtistOsFieldOption[] = [
  { label: "Frio", value: "frio" },
  { label: "Quente", value: "quente" },
  { label: "Proposta enviada", value: "proposta_enviada" },
  { label: "Aguardando resposta", value: "aguardando_resposta" },
  { label: "Fechado", value: "fechado" },
  { label: "Perdido", value: "perdido" },
];

export const brandDealStatusOptions: ArtistOsFieldOption[] = [
  { label: "Prospecção", value: "prospeccao" },
  { label: "Proposta enviada", value: "proposta_enviada" },
  { label: "Negociando", value: "negociando" },
  { label: "Aprovado", value: "aprovado" },
  { label: "Contrato", value: "contrato" },
  { label: "Produção", value: "producao" },
  { label: "Publicado", value: "publicado" },
  { label: "Comprovado", value: "comprovado" },
  { label: "Pago", value: "pago" },
  { label: "Finalizado", value: "finalizado" },
  { label: "Cancelado", value: "cancelado" },
];

export const financeStatusOptions: ArtistOsFieldOption[] = [
  { label: "Previsto", value: "previsto" },
  { label: "Recebido", value: "recebido" },
  { label: "Pago", value: "pago" },
  { label: "Atrasado", value: "atrasado" },
  { label: "Cancelado", value: "cancelado" },
];

export const taskStatusOptions: ArtistOsFieldOption[] = [
  { label: "Pendente", value: "pendente" },
  { label: "Em andamento", value: "em_andamento" },
  { label: "Aguardando", value: "aguardando" },
  { label: "Concluída", value: "concluida" },
  { label: "Cancelada", value: "cancelada" },
];

export const priorityOptions: ArtistOsFieldOption[] = [
  { label: "Baixa", value: "baixa" },
  { label: "Média", value: "media" },
  { label: "Alta", value: "alta" },
  { label: "Urgente", value: "urgente" },
];

export const contractStatusOptions: ArtistOsFieldOption[] = [
  { label: "Aguardando", value: "aguardando" },
  { label: "Enviado", value: "enviado" },
  { label: "Assinado", value: "assinado" },
  { label: "Vencido", value: "vencido" },
  { label: "Cancelado", value: "cancelado" },
];

export const artistOsResources = {
  artists: {
    key: "artists",
    table: "artist_os_artists",
    title: "Artistas",
    eyebrow: "Roster",
    description: "Cadastro central de artistas, DJs, produtores, influenciadores e bandas.",
    singular: "artista",
    newLabel: "Novo artista",
    icon: UsersRound,
    primaryField: "stage_name",
    secondaryField: "city",
    statusField: "status",
    searchFields: ["stage_name", "full_name", "city", "state", "email"],
    fields: [
      { key: "stage_name", label: "Nome artístico", type: "text", required: true },
      { key: "full_name", label: "Nome completo", type: "text" },
      { key: "artist_type", label: "Tipo", type: "select", options: artistTypeOptions },
      { key: "city", label: "Cidade", type: "text" },
      { key: "state", label: "Estado", type: "text" },
      { key: "country", label: "País", type: "text", placeholder: "BR" },
      { key: "email", label: "E-mail", type: "email" },
      { key: "phone", label: "Telefone", type: "tel" },
      { key: "instagram_url", label: "Instagram", type: "url" },
      { key: "tiktok_url", label: "TikTok", type: "url" },
      { key: "youtube_url", label: "YouTube", type: "url" },
      { key: "spotify_url", label: "Spotify", type: "url" },
      { key: "apple_music_url", label: "Apple Music", type: "url" },
      { key: "default_fee", label: "Cachê padrão", type: "number" },
      { key: "default_commission", label: "Comissão padrão %", type: "number" },
      { key: "status", label: "Status", type: "select", options: artistStatusOptions },
      { key: "notes", label: "Observações", type: "textarea", span: "full" },
    ],
    columns: [
      { key: "stage_name", label: "Artista" },
      { key: "artist_type", label: "Tipo" },
      { key: "city", label: "Cidade" },
      { key: "default_fee", label: "Cachê", type: "money" },
      { key: "status", label: "Status", type: "status" },
    ],
    filters: [{ key: "status", label: "Status", type: "select", options: artistStatusOptions }],
  },
  shows: {
    key: "shows",
    table: "artist_os_shows",
    title: "Agenda de Shows",
    eyebrow: "Booking",
    description: "Controle de agenda, negociação, sinal, logística e execução dos shows.",
    singular: "show",
    newLabel: "Novo show",
    icon: CalendarDays,
    primaryField: "event_name",
    secondaryField: "city",
    statusField: "status",
    searchFields: ["event_name", "city", "state", "venue", "contractor_name"],
    fields: [
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "event_name", label: "Nome do evento", type: "text", required: true },
      { key: "city", label: "Cidade", type: "text" },
      { key: "state", label: "Estado", type: "text" },
      { key: "country", label: "País", type: "text", placeholder: "BR" },
      { key: "venue", label: "Local", type: "text" },
      { key: "event_date", label: "Data", type: "date" },
      { key: "event_time", label: "Horário", type: "time" },
      { key: "contractor_name", label: "Contratante", type: "text" },
      { key: "contractor_phone", label: "Telefone do contratante", type: "tel" },
      { key: "fee_value", label: "Valor do cachê", type: "number" },
      { key: "logistics_included", label: "Logística inclusa", type: "checkbox" },
      { key: "deposit_value", label: "Valor de sinal", type: "number" },
      { key: "remaining_value", label: "Valor restante", type: "number" },
      { key: "status", label: "Status", type: "select", options: showStatusOptions },
      { key: "team_involved", label: "Equipe envolvida", type: "text" },
      { key: "hotel", label: "Hotel", type: "text" },
      { key: "flights", label: "Passagens", type: "text" },
      { key: "transport", label: "Transporte", type: "text" },
      { key: "contract_id", label: "Contrato vinculado", type: "text" },
      { key: "receipt_links", label: "Comprovantes vinculados", type: "textarea", span: "full" },
      { key: "notes", label: "Observações", type: "textarea", span: "full" },
    ],
    columns: [
      { key: "event_name", label: "Evento" },
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "event_date", label: "Data", type: "date" },
      { key: "city", label: "Cidade" },
      { key: "fee_value", label: "Cachê", type: "money" },
      { key: "status", label: "Status", type: "status" },
    ],
    filters: [
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "status", label: "Status", type: "select", options: showStatusOptions },
      { key: "event_date", label: "Mês", type: "month" },
    ],
  },
  deals: {
    key: "deals",
    table: "artist_os_deals",
    title: "Negociações",
    eyebrow: "CRM",
    description: "Pipeline comercial para leads de eventos e oportunidades.",
    singular: "negociação",
    newLabel: "Nova negociação",
    icon: BriefcaseBusiness,
    primaryField: "contact_name",
    secondaryField: "event_type",
    statusField: "status",
    searchFields: ["contact_name", "city", "event_type", "lead_source"],
    fields: [
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "contact_name", label: "Nome do contato", type: "text", required: true },
      { key: "phone", label: "Telefone", type: "tel" },
      { key: "email", label: "E-mail", type: "email" },
      { key: "city", label: "Cidade", type: "text" },
      { key: "event_type", label: "Tipo de evento", type: "text" },
      { key: "desired_date", label: "Data desejada", type: "date" },
      { key: "estimated_budget", label: "Orçamento estimado", type: "number" },
      { key: "lead_source", label: "Origem do lead", type: "text" },
      { key: "status", label: "Status", type: "select", options: dealStatusOptions },
      { key: "next_action", label: "Próxima ação", type: "text" },
      { key: "next_action_date", label: "Data da próxima ação", type: "date" },
      { key: "notes", label: "Observações", type: "textarea", span: "full" },
    ],
    columns: [
      { key: "contact_name", label: "Contato" },
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "event_type", label: "Evento" },
      { key: "estimated_budget", label: "Budget", type: "money" },
      { key: "next_action_date", label: "Próxima ação", type: "date" },
      { key: "status", label: "Status", type: "status" },
    ],
    filters: [
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "status", label: "Status", type: "select", options: dealStatusOptions },
    ],
  },
  "brand-deals": {
    key: "brand-deals",
    table: "artist_os_brand_deals",
    title: "Publicidade",
    eyebrow: "Brand Deals",
    description: "Campanhas, publis, collabs e parcerias com marcas.",
    singular: "campanha",
    newLabel: "Nova campanha",
    icon: Megaphone,
    primaryField: "brand",
    secondaryField: "campaign_name",
    statusField: "status",
    searchFields: ["brand", "agency", "campaign_name", "responsible_contact"],
    fields: [
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "brand", label: "Marca", type: "text", required: true },
      { key: "agency", label: "Agência", type: "text" },
      { key: "responsible_contact", label: "Contato responsável", type: "text" },
      { key: "campaign_name", label: "Produto/campanha", type: "text" },
      { key: "negotiated_value", label: "Valor negociado", type: "number" },
      { key: "campaign_start", label: "Início da campanha", type: "date" },
      { key: "campaign_end", label: "Fim da campanha", type: "date" },
      { key: "status", label: "Status", type: "select", options: brandDealStatusOptions },
      { key: "advisor_approval", label: "Aprovação da assessoria", type: "checkbox" },
      { key: "deliverables", label: "Entregas combinadas", type: "textarea", span: "full" },
      { key: "published_links", label: "Links publicados", type: "textarea", span: "full" },
      { key: "proof_links", label: "Prints/comprovações", type: "textarea", span: "full" },
      { key: "notes", label: "Observações", type: "textarea", span: "full" },
    ],
    columns: [
      { key: "brand", label: "Marca" },
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "campaign_name", label: "Campanha" },
      { key: "negotiated_value", label: "Valor", type: "money" },
      { key: "campaign_end", label: "Fim", type: "date" },
      { key: "status", label: "Status", type: "status" },
    ],
    filters: [
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "status", label: "Status", type: "select", options: brandDealStatusOptions },
    ],
  },
  finance: {
    key: "finance",
    table: "artist_os_finance",
    title: "Financeiro",
    eyebrow: "Caixa",
    description: "Entradas, saídas, vencimentos, comprovantes e caixa por artista.",
    singular: "movimentação",
    newLabel: "Nova movimentação",
    icon: BadgeDollarSign,
    primaryField: "description",
    secondaryField: "category",
    statusField: "status",
    searchFields: ["description", "category", "payment_method", "linked_to_type"],
    fields: [
      { key: "artist_id", label: "Artista", type: "artist" },
      {
        key: "transaction_type",
        label: "Tipo",
        type: "select",
        options: [
          { label: "Entrada", value: "entrada" },
          { label: "Saída", value: "saida" },
        ],
      },
      { key: "category", label: "Categoria", type: "text" },
      { key: "description", label: "Descrição", type: "text", required: true },
      { key: "amount", label: "Valor", type: "number" },
      { key: "occurred_on", label: "Data", type: "date" },
      { key: "due_date", label: "Vencimento", type: "date" },
      { key: "payment_method", label: "Forma de pagamento", type: "text" },
      { key: "status", label: "Status", type: "select", options: financeStatusOptions },
      { key: "linked_to_type", label: "Vinculado a", type: "text" },
      { key: "receipt_url", label: "Comprovante", type: "url" },
      { key: "notes", label: "Observações", type: "textarea", span: "full" },
    ],
    columns: [
      { key: "description", label: "Descrição" },
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "transaction_type", label: "Tipo" },
      { key: "category", label: "Categoria" },
      { key: "amount", label: "Valor", type: "money" },
      { key: "due_date", label: "Vencimento", type: "date" },
      { key: "status", label: "Status", type: "status" },
    ],
    filters: [
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "status", label: "Status", type: "select", options: financeStatusOptions },
    ],
  },
  contracts: {
    key: "contracts",
    table: "artist_os_contracts",
    title: "Contratos",
    eyebrow: "Legal",
    description: "Controle de contratos, arquivos, vencimentos e vínculos.",
    singular: "contrato",
    newLabel: "Novo contrato",
    icon: FileSignature,
    primaryField: "counterparty",
    secondaryField: "contract_type",
    statusField: "status",
    searchFields: ["counterparty", "contract_type", "linked_to_type"],
    fields: [
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "contract_type", label: "Tipo de contrato", type: "text" },
      { key: "counterparty", label: "Parte contratante", type: "text", required: true },
      { key: "value", label: "Valor", type: "number" },
      { key: "signed_at", label: "Data de assinatura", type: "date" },
      { key: "due_at", label: "Data de vencimento", type: "date" },
      { key: "status", label: "Status", type: "select", options: contractStatusOptions },
      { key: "file_url", label: "Arquivo PDF", type: "url" },
      { key: "linked_to_type", label: "Vínculo", type: "text" },
      { key: "notes", label: "Observações", type: "textarea", span: "full" },
    ],
    columns: [
      { key: "counterparty", label: "Parte" },
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "contract_type", label: "Tipo" },
      { key: "value", label: "Valor", type: "money" },
      { key: "due_at", label: "Vencimento", type: "date" },
      { key: "status", label: "Status", type: "status" },
    ],
    filters: [
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "status", label: "Status", type: "select", options: contractStatusOptions },
    ],
  },
  tasks: {
    key: "tasks",
    table: "artist_os_tasks",
    title: "Tarefas",
    eyebrow: "Operação",
    description: "Tarefas por responsável, prioridade, prazo e vínculo operacional.",
    singular: "tarefa",
    newLabel: "Nova tarefa",
    icon: ClipboardCheck,
    primaryField: "title",
    secondaryField: "assignee",
    statusField: "status",
    searchFields: ["title", "description", "assignee", "linked_to_type"],
    fields: [
      { key: "title", label: "Título", type: "text", required: true },
      { key: "assignee", label: "Responsável", type: "text" },
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "priority", label: "Prioridade", type: "select", options: priorityOptions },
      { key: "status", label: "Status", type: "select", options: taskStatusOptions },
      { key: "due_at", label: "Prazo", type: "date" },
      { key: "linked_to_type", label: "Vinculado a", type: "text" },
      { key: "description", label: "Descrição", type: "textarea", span: "full" },
    ],
    columns: [
      { key: "title", label: "Tarefa" },
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "assignee", label: "Responsável" },
      { key: "priority", label: "Prioridade", type: "status" },
      { key: "due_at", label: "Prazo", type: "date" },
      { key: "status", label: "Status", type: "status" },
    ],
    filters: [
      { key: "artist_id", label: "Artista", type: "artist" },
      { key: "status", label: "Status", type: "select", options: taskStatusOptions },
      { key: "priority", label: "Prioridade", type: "select", options: priorityOptions },
    ],
  },
} satisfies Record<ArtistOsResourceKey, ArtistOsResourceConfig>;

export const artistOsNavigation: ArtistOsSectionConfig[] = [
  { key: "overview", label: "Visão Geral", href: "/artist-os", icon: BarChart3 },
  { key: "artists", label: "Artistas", href: "/artist-os/artists", icon: UsersRound },
  { key: "shows", label: "Agenda", href: "/artist-os/shows", icon: CalendarDays },
  { key: "deals", label: "Negociações", href: "/artist-os/deals", icon: BriefcaseBusiness },
  { key: "brand-deals", label: "Publicidade", href: "/artist-os/brand-deals", icon: Megaphone },
  { key: "finance", label: "Financeiro", href: "/artist-os/finance", icon: BadgeDollarSign },
  { key: "contracts", label: "Contratos", href: "/artist-os/contracts", icon: FileSignature },
  { key: "tasks", label: "Tarefas", href: "/artist-os/tasks", icon: ClipboardCheck },
  { key: "reports", label: "Relatórios", href: "/artist-os/reports", icon: BarChart3 },
  { key: "settings", label: "Configurações", href: "/artist-os/settings", icon: Settings2 },
];

export function getArtistOsResourceConfig(key: string) {
  return artistOsResources[key as ArtistOsResourceKey] ?? null;
}

