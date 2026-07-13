import "server-only";
import { generateLabelContractPdf } from "@/lib/label-contract-pdf";
import type {
  ContractSnapshotParty,
  LabelContract,
  LabelContractSnapshotV1,
  LabelContractStatus,
} from "@/lib/label-contract-types";
import { ensureLabelStorageBucket } from "@/lib/label-os-storage";
import { requireLabelWorkspaceId } from "@/lib/label-os-workspace";
import { getTrackReadinessBundle } from "@/lib/label-readiness-server";
import type { TrackReadinessBundle } from "@/lib/label-readiness-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceContext } from "@/lib/workspaces";

function participantName(
  participant: TrackReadinessBundle["participants"][number],
) {
  return (
    participant.label_artists?.artist_name ??
    participant.label_artists?.name ??
    participant.label_entities?.display_name ??
    participant.label_entities?.name ??
    "Participante"
  );
}

function entityParty(
  bundle: TrackReadinessBundle,
  entityId: string,
  role: string,
  percentage: number | null,
  options: { recoupable?: boolean; notes?: string | null } = {},
): ContractSnapshotParty {
  const entity = bundle.entities.find((item) => item.id === entityId);
  return {
    name: entity?.display_name ?? entity?.name ?? "Participante",
    legalName: entity?.name ?? null,
    document: entity?.document ?? null,
    role,
    percentage,
    ipiCae: entity?.ipi_cae ?? null,
    rightsSociety: entity?.rights_society ?? null,
    publisher: entity?.publisher_name ?? null,
    ...options,
  };
}

function participantParty(
  bundle: TrackReadinessBundle,
  participant: TrackReadinessBundle["participants"][number],
): ContractSnapshotParty {
  const entity = participant.entity_id
    ? bundle.entities.find((item) => item.id === participant.entity_id)
    : null;
  return {
    name: participantName(participant),
    legalName: entity?.name ?? participant.label_artists?.name ?? null,
    document: entity?.document ?? null,
    role: participant.role,
    percentage:
      Number(participant.royalty_percentage) ||
      Number(participant.master_percentage) ||
      Number(participant.publishing_percentage) ||
      null,
    ipiCae: entity?.ipi_cae ?? null,
    rightsSociety: entity?.rights_society ?? null,
    publisher: entity?.publisher_name ?? null,
  };
}

export function buildLabelContractSnapshot(
  bundle: TrackReadinessBundle,
  metadata: {
    contractNumber: string;
    generatedAt: string;
    generatedById: string | null;
    generatedByName: string;
    workspaceId: string;
    workspaceName: string;
  },
): LabelContractSnapshotV1 {
  const { track, manual, result } = bundle;
  const explicitPrimary = bundle.participants.filter(
    (item) => item.role === "main_artist",
  );
  const primary = (
    explicitPrimary.length > 0
      ? explicitPrimary
      : bundle.participants.filter(
          (item) => item.artist_id && item.role !== "featured_artist",
        )
  ).map(participantName);
  const featured = bundle.participants
    .filter((item) => item.role === "featured_artist")
    .map(participantName);
  const composers = bundle.compositions.map((item) =>
    entityParty(bundle, item.entity_id, item.role, Number(item.percentage)),
  );
  const masterParticipants = bundle.masterSplits.map((item) =>
    entityParty(
      bundle,
      item.entity_id,
      item.role ?? item.group_type,
      Number(item.percentage),
    ),
  );
  const royaltyParticipants = bundle.royaltySplits.map((item) =>
    entityParty(
      bundle,
      item.entity_id,
      item.role ?? "royalties",
      Number(item.percentage),
      {
        recoupable: item.recoupable,
        notes: item.notes,
      },
    ),
  );

  return {
    version: 1,
    contractNumber: metadata.contractNumber,
    generatedAt: metadata.generatedAt,
    generatedBy: {
      id: metadata.generatedById,
      name: metadata.generatedByName,
    },
    workspace: { id: metadata.workspaceId, name: metadata.workspaceName },
    track: {
      id: track.id,
      title: track.title,
      version: track.version,
      status: track.status,
      isrc: track.isrc,
      upc: track.upc,
      releaseDate: track.release_date,
      genre: track.genre,
      subgenre: track.subgenre,
      explicit: track.explicit,
      notes: track.notes,
    },
    artists: {
      primary: Array.from(new Set(primary)),
      featured: Array.from(new Set(featured)),
    },
    participants: bundle.participants.map((participant) =>
      participantParty(bundle, participant),
    ),
    work: {
      registered: manual?.work_registered ?? false,
      registrationSociety: manual?.work_registration_society ?? null,
      proofAttached: manual?.work_registration_proof_attached ?? false,
      composers,
    },
    master: {
      pLine: manual?.p_line ?? null,
      cLine: manual?.c_line ?? null,
      owner: manual?.master_owner ?? null,
      participants: masterParticipants,
    },
    royalties: {
      participants: royaltyParticipants,
      labelCommissionPercentage: manual?.label_commission_percentage ?? null,
      paymentRule: manual?.payment_rule ?? null,
    },
    distribution: {
      distributor: manual?.distributor ?? null,
      releaseCreated: manual?.symphonic_release_created ?? false,
      deliveredToStores: manual?.delivered_to_stores ?? false,
      published: manual?.published ?? false,
    },
    files: {
      audioAttached: Boolean(track.audio_url),
      coverAttached: Boolean(track.cover_url),
      audioApproved: manual?.wav_approved ?? false,
      coverApproved: manual?.cover_approved ?? false,
    },
    responsible: manual?.responsible ?? null,
    observations: manual?.notes ?? track.notes,
    readiness: {
      score: result.readinessScore,
      isReadyToDistribute: result.isReadyToDistribute,
      blockingIssues: result.blockingIssues,
      warnings: result.warnings,
    },
  };
}

export async function getLabelContracts(options?: {
  status?: LabelContractStatus | "all";
  query?: string;
}) {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  let request = supabase
    .from("label_contracts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (options?.status && options.status !== "all") {
    request = request.eq("status", options.status);
  }

  const { data, error } = await request;
  if (error) throw new Error(`getLabelContracts: ${error.message}`);

  const rows = (data ?? []) as LabelContract[];
  const query = options?.query?.trim().toLocaleLowerCase("pt-BR");
  if (!query) return rows;

  return rows.filter((contract) => {
    const searchable = [
      contract.contract_number,
      contract.snapshot.track.title,
      ...contract.snapshot.artists.primary,
      ...contract.snapshot.artists.featured,
    ]
      .join(" ")
      .toLocaleLowerCase("pt-BR");
    return searchable.includes(query);
  });
}

export async function getLabelContractsByTrack(trackId: string) {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_contracts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("track_id", trackId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`getLabelContractsByTrack: ${error.message}`);
  return (data ?? []) as LabelContract[];
}

export async function getLabelContractById(contractId: string) {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_contracts")
    .select("*")
    .eq("id", contractId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw new Error(`getLabelContractById: ${error.message}`);
  return (data as LabelContract | null) ?? null;
}

export async function createLabelContractFromTrack(trackId: string) {
  const [workspaceId, workspace, supabase, bundle] = await Promise.all([
    requireLabelWorkspaceId(),
    getCurrentWorkspaceContext(),
    createClient(),
    getTrackReadinessBundle(trackId),
  ]);
  if (!bundle) throw new Error("Track não encontrada neste workspace.");

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  const id = crypto.randomUUID();
  const generatedAt = new Date().toISOString();
  const contractNumber = `MBOS-${generatedAt.slice(0, 4)}-${id.slice(0, 8).toUpperCase()}`;
  const generatedByName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "Usuário do Label OS";
  const snapshot = buildLabelContractSnapshot(bundle, {
    contractNumber,
    generatedAt,
    generatedById: user?.id ?? null,
    generatedByName,
    workspaceId,
    workspaceName: workspace?.workspace.name ?? "Label OS",
  });
  const pdfBytes = await generateLabelContractPdf(snapshot);
  const pdfPath = `${workspaceId}/contracts/${trackId}/${id}/generated.pdf`;
  const storage =
    (await ensureLabelStorageBucket("label-contracts")) ?? supabase;
  const uploaded = await storage.storage
    .from("label-contracts")
    .upload(pdfPath, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploaded.error) {
    throw new Error(`Não foi possível salvar o PDF: ${uploaded.error.message}`);
  }

  const { data, error } = await supabase
    .from("label_contracts")
    .insert({
      id,
      workspace_id: workspaceId,
      track_id: trackId,
      contract_number: contractNumber,
      title: `Contrato - ${bundle.track.title}`,
      contract_type: "authorization_release_royalties",
      status: "generated",
      snapshot,
      pdf_path: pdfPath,
      created_by: user?.id ?? null,
      created_by_name: generatedByName,
      generated_at: generatedAt,
    })
    .select("*")
    .single();

  if (error) {
    await storage.storage.from("label-contracts").remove([pdfPath]);
    throw new Error(`Não foi possível registrar o contrato: ${error.message}`);
  }

  return data as LabelContract;
}

export async function updateLabelContractStatus(
  contractId: string,
  status: LabelContractStatus,
) {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const timestamps = {
    sent_at: status === "sent" ? new Date().toISOString() : undefined,
    signed_at: status === "signed" ? new Date().toISOString() : undefined,
    cancelled_at: status === "cancelled" ? new Date().toISOString() : undefined,
  };
  const { data, error } = await supabase
    .from("label_contracts")
    .update({ status, ...timestamps })
    .eq("id", contractId)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) throw new Error(`updateLabelContractStatus: ${error.message}`);
  return data as LabelContract;
}

export async function attachSignedLabelContract(
  contract: LabelContract,
  file: File,
) {
  const workspaceId = await requireLabelWorkspaceId();
  if (contract.workspace_id !== workspaceId) {
    throw new Error("Contrato não encontrado neste workspace.");
  }

  const supabase = await createClient();
  const storage =
    (await ensureLabelStorageBucket("label-contracts")) ?? supabase;
  const path = `${workspaceId}/contracts/${contract.track_id}/${contract.id}/signed-${Date.now()}.pdf`;
  const uploaded = await storage.storage
    .from("label-contracts")
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploaded.error) {
    throw new Error(
      `Não foi possível anexar o assinado: ${uploaded.error.message}`,
    );
  }

  const { data, error } = await supabase
    .from("label_contracts")
    .update({
      signed_pdf_path: path,
      signed_file_name: file.name,
      signed_at: new Date().toISOString(),
      status: "signed",
    })
    .eq("id", contract.id)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) {
    await storage.storage.from("label-contracts").remove([path]);
    throw new Error(`Não foi possível registrar o assinado: ${error.message}`);
  }

  if (contract.signed_pdf_path && contract.signed_pdf_path !== path) {
    await storage.storage
      .from("label-contracts")
      .remove([contract.signed_pdf_path]);
  }

  return data as LabelContract;
}

export async function downloadLabelContractFile(
  contract: LabelContract,
  kind: "generated" | "signed",
) {
  const workspaceId = await requireLabelWorkspaceId();
  if (contract.workspace_id !== workspaceId) {
    throw new Error("Contrato não encontrado neste workspace.");
  }

  const path = kind === "signed" ? contract.signed_pdf_path : contract.pdf_path;
  if (!path) throw new Error("Arquivo de contrato não encontrado.");
  const supabase = createAdminClient() ?? (await createClient());
  const { data, error } = await supabase.storage
    .from("label-contracts")
    .download(path);
  if (error) throw new Error(`downloadLabelContractFile: ${error.message}`);
  return data;
}
