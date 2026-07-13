export const LABEL_CONTRACT_STATUSES = [
  "draft",
  "generated",
  "sent",
  "signed",
  "expired",
  "cancelled",
] as const;

export type LabelContractStatus = (typeof LABEL_CONTRACT_STATUSES)[number];

export const LABEL_CONTRACT_STATUS_LABELS: Record<LabelContractStatus, string> =
  {
    draft: "Rascunho",
    generated: "Gerado",
    sent: "Enviado para assinatura",
    signed: "Assinado",
    expired: "Vencido",
    cancelled: "Cancelado",
  };

export const LABEL_CONTRACT_TYPES = [
  "authorization_release_royalties",
  "artistic_participation_release",
  "master_release",
  "royalties_split",
  "distribution_authorization",
  "label_artist",
  "publishing_authoral",
] as const;

export type LabelContractType = (typeof LABEL_CONTRACT_TYPES)[number];

export const LABEL_CONTRACT_TYPE_LABELS: Record<LabelContractType, string> = {
  authorization_release_royalties:
    "Autorização, liberação e divisão de royalties",
  artistic_participation_release: "Liberação de participação artística",
  master_release: "Liberação de fonograma/master",
  royalties_split: "Acordo de divisão de royalties",
  distribution_authorization: "Autorização de distribuição",
  label_artist: "Contrato de selo/artista",
  publishing_authoral: "Contrato de edição/autoral",
};

export type ContractSnapshotParty = {
  name: string;
  legalName: string | null;
  document: string | null;
  role: string;
  percentage: number | null;
  ipiCae: string | null;
  rightsSociety: string | null;
  publisher: string | null;
  recoupable?: boolean;
  notes?: string | null;
};

export type LabelContractSnapshotV1 = {
  version: 1;
  contractNumber: string;
  generatedAt: string;
  generatedBy: {
    id: string | null;
    name: string;
  };
  workspace: {
    id: string;
    name: string;
  };
  track: {
    id: string;
    title: string;
    version: string | null;
    status: string;
    isrc: string | null;
    upc: string | null;
    releaseDate: string | null;
    genre: string | null;
    subgenre: string | null;
    explicit: boolean;
    notes: string | null;
  };
  artists: {
    primary: string[];
    featured: string[];
  };
  participants: ContractSnapshotParty[];
  work: {
    registered: boolean;
    registrationSociety: string | null;
    proofAttached: boolean;
    composers: ContractSnapshotParty[];
  };
  master: {
    pLine: string | null;
    cLine: string | null;
    owner: string | null;
    participants: ContractSnapshotParty[];
  };
  royalties: {
    participants: ContractSnapshotParty[];
    labelCommissionPercentage: number | null;
    paymentRule: string | null;
  };
  distribution: {
    distributor: string | null;
    releaseCreated: boolean;
    deliveredToStores: boolean;
    published: boolean;
  };
  files: {
    audioAttached: boolean;
    coverAttached: boolean;
    audioApproved: boolean;
    coverApproved: boolean;
  };
  responsible: string | null;
  observations: string | null;
  readiness: {
    score: number;
    isReadyToDistribute: boolean;
    blockingIssues: string[];
    warnings: string[];
  };
};

export type LabelContract = {
  id: string;
  workspace_id: string;
  track_id: string;
  contract_number: string;
  title: string;
  contract_type: LabelContractType;
  status: LabelContractStatus;
  snapshot: LabelContractSnapshotV1;
  pdf_path: string;
  signed_pdf_path: string | null;
  signed_file_name: string | null;
  created_by: string | null;
  created_by_name: string | null;
  generated_at: string;
  sent_at: string | null;
  signed_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReadinessContractEvidence = Pick<
  LabelContract,
  "status" | "pdf_path" | "signed_pdf_path"
>;
