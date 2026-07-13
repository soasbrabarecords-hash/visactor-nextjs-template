import type { ReadinessContractEvidence } from "@/lib/label-contract-types";
import type { LabelEntity } from "@/lib/label-entities-types";
import type { LabelTrack, TrackParticipant } from "@/lib/label-os-types";
import type {
  TrackComposition,
  TrackMasterSplit,
  TrackRoyaltySplit,
} from "@/lib/label-splits-types";

export const READINESS_AREAS = [
  "track",
  "work",
  "master",
  "royalties",
  "contracts",
  "distribution",
  "files",
] as const;

export type ReadinessAreaKey = (typeof READINESS_AREAS)[number];
export type ReadinessPriority = "low" | "medium" | "high" | "urgent";
export type ReadinessTaskStatus = "todo" | "in_progress" | "done";

export type LabelTrackReadiness = {
  id: string;
  workspace_id: string;
  track_id: string;
  work_registered: boolean;
  work_registration_society: string | null;
  work_registration_proof_attached: boolean;
  p_line: string | null;
  c_line: string | null;
  master_owner: string | null;
  wav_approved: boolean;
  cover_approved: boolean;
  distributor: string | null;
  label_commission_percentage: number | null;
  payment_data_confirmed: boolean;
  contracts_approved: boolean;
  featured_contract_approved: boolean;
  payment_rule: string | null;
  symphonic_release_created: boolean;
  delivered_to_stores: boolean;
  published: boolean;
  responsible: string | null;
  priority: ReadinessPriority;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LabelTrackReadinessInput = Omit<
  LabelTrackReadiness,
  | "id"
  | "workspace_id"
  | "track_id"
  | "created_by"
  | "created_at"
  | "updated_at"
>;

export type LabelTrackTask = {
  id: string;
  workspace_id: string;
  track_id: string;
  area: ReadinessAreaKey;
  title: string;
  responsible: string | null;
  priority: ReadinessPriority;
  status: ReadinessTaskStatus;
  due_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LabelTrackTaskInput = Pick<
  LabelTrackTask,
  | "area"
  | "title"
  | "responsible"
  | "priority"
  | "status"
  | "due_date"
  | "notes"
>;

export type ReadinessCheck = {
  id: string;
  area: ReadinessAreaKey;
  title: string;
  complete: boolean;
  severity: "blocking" | "warning";
  source: "automatic" | "manual";
  action: string;
  priority: ReadinessPriority;
};

export type ReadinessAreaResult = {
  key: ReadinessAreaKey;
  label: string;
  score: number;
  completed: number;
  total: number;
  blockingCount: number;
  warningCount: number;
  checks: ReadinessCheck[];
};

export type NextRecommendedAction = {
  title: string;
  responsible: string;
  priority: ReadinessPriority;
  area: ReadinessAreaKey;
  taskId?: string;
};

export type TrackReadinessResult = {
  isReadyToDistribute: boolean;
  readinessScore: number;
  blockingIssues: string[];
  warnings: string[];
  nextRecommendedAction: NextRecommendedAction | null;
  areas: ReadinessAreaResult[];
};

export type TrackReadinessInput = {
  track: LabelTrack;
  participants: TrackParticipant[];
  compositions: TrackComposition[];
  masterSplits: TrackMasterSplit[];
  royaltySplits: TrackRoyaltySplit[];
  entities: LabelEntity[];
  manual: LabelTrackReadiness | null;
  tasks: LabelTrackTask[];
  contracts: ReadinessContractEvidence[];
};

export type TrackReadinessBundle = TrackReadinessInput & {
  result: TrackReadinessResult;
};

export const EMPTY_TRACK_READINESS: LabelTrackReadinessInput = {
  work_registered: false,
  work_registration_society: null,
  work_registration_proof_attached: false,
  p_line: null,
  c_line: null,
  master_owner: null,
  wav_approved: false,
  cover_approved: false,
  distributor: null,
  label_commission_percentage: null,
  payment_data_confirmed: false,
  contracts_approved: false,
  featured_contract_approved: false,
  payment_rule: null,
  symphonic_release_created: false,
  delivered_to_stores: false,
  published: false,
  responsible: null,
  priority: "medium",
  notes: null,
};

export const READINESS_AREA_LABELS: Record<ReadinessAreaKey, string> = {
  track: "Track",
  work: "Obra",
  master: "Fonograma",
  royalties: "Royalties",
  contracts: "Contratos e documentos",
  distribution: "Distribuição",
  files: "Arquivos",
};
