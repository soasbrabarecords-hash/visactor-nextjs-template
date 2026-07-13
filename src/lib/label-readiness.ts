import type {
  LabelTrackReadinessInput,
  ReadinessAreaKey,
  ReadinessAreaResult,
  ReadinessCheck,
  ReadinessPriority,
  TrackReadinessInput,
  TrackReadinessResult,
} from "@/lib/label-readiness-types";
import {
  EMPTY_TRACK_READINESS,
  READINESS_AREAS,
  READINESS_AREA_LABELS,
} from "@/lib/label-readiness-types";

const PRIORITY_WEIGHT: Record<ReadinessPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function closesAtHundred(values: Array<number | string | null | undefined>) {
  if (values.length === 0) return false;
  const total = values.reduce<number>(
    (sum, value) => sum + Number(value ?? 0),
    0,
  );
  return Math.abs(total - 100) < 0.01;
}

function check(
  area: ReadinessAreaKey,
  id: string,
  title: string,
  complete: boolean,
  severity: ReadinessCheck["severity"],
  source: ReadinessCheck["source"],
  action: string,
  priority: ReadinessPriority = severity === "blocking" ? "high" : "medium",
): ReadinessCheck {
  return { area, id, title, complete, severity, source, action, priority };
}

function buildArea(
  key: ReadinessAreaKey,
  checks: ReadinessCheck[],
): ReadinessAreaResult {
  const completed = checks.filter((item) => item.complete).length;
  const failed = checks.filter((item) => !item.complete);

  return {
    key,
    label: READINESS_AREA_LABELS[key],
    score:
      checks.length > 0 ? Math.round((completed / checks.length) * 100) : 100,
    completed,
    total: checks.length,
    blockingCount: failed.filter((item) => item.severity === "blocking").length,
    warningCount: failed.filter((item) => item.severity === "warning").length,
    checks,
  };
}

export function evaluateTrackReadiness(
  input: TrackReadinessInput,
): TrackReadinessResult {
  const {
    track,
    participants,
    compositions,
    masterSplits,
    royaltySplits,
    entities,
    tasks,
    contracts,
  } = input;
  const manual: LabelTrackReadinessInput =
    input.manual ?? EMPTY_TRACK_READINESS;
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const compositionEntities = compositions
    .map((item) => entityById.get(item.entity_id))
    .filter((entity) => Boolean(entity));
  const royaltyEntities = royaltySplits
    .map((item) => entityById.get(item.entity_id))
    .filter((entity) => Boolean(entity));
  const hasFeaturedArtist = participants.some(
    (item) => item.role === "featured_artist",
  );
  const hasPrimaryArtist = participants.some(
    (item) =>
      item.role === "main_artist" ||
      item.role === "featured_artist" ||
      item.artist_id,
  );
  const hasGeneratedContract = contracts.some((item) => Boolean(item.pdf_path));
  const hasSignedContract = contracts.some(
    (item) => item.status === "signed" && Boolean(item.signed_pdf_path),
  );

  const checks: ReadinessCheck[] = [
    check(
      "track",
      "track-title",
      "Título da track preenchido",
      hasText(track.title),
      "blocking",
      "automatic",
      "Preencher o título da track",
    ),
    check(
      "track",
      "track-artist",
      "Artista principal cadastrado",
      hasPrimaryArtist,
      "blocking",
      "automatic",
      "Adicionar o artista principal",
    ),
    check(
      "track",
      "track-genre",
      "Gênero informado",
      hasText(track.genre),
      "blocking",
      "automatic",
      "Definir o gênero da track",
    ),
    check(
      "track",
      "track-release-date",
      "Data de lançamento definida",
      hasText(track.release_date),
      "blocking",
      "automatic",
      "Definir a data de lançamento",
    ),
    check(
      "track",
      "track-upc",
      "UPC informado",
      hasText(track.upc),
      "warning",
      "automatic",
      "Informar o UPC quando o release estiver criado",
    ),

    check(
      "work",
      "work-composers",
      "Todos os compositores cadastrados",
      compositions.length > 0,
      "blocking",
      "automatic",
      "Cadastrar os compositores da obra",
      "urgent",
    ),
    check(
      "work",
      "work-split",
      "Percentual autoral fecha 100%",
      closesAtHundred(compositions.map((item) => item.percentage)),
      "blocking",
      "automatic",
      "Ajustar o split autoral para 100%",
      "urgent",
    ),
    check(
      "work",
      "work-ipi",
      "IPI/CAE informado para os compositores",
      compositionEntities.length === compositions.length &&
        compositionEntities.every((entity) => hasText(entity?.ipi_cae)),
      "warning",
      "automatic",
      "Completar IPI/CAE dos compositores",
    ),
    check(
      "work",
      "work-society",
      "Associação autoral informada",
      compositionEntities.length === compositions.length &&
        compositionEntities.every((entity) => hasText(entity?.rights_society)),
      "warning",
      "automatic",
      "Informar a associação autoral dos compositores",
    ),
    check(
      "work",
      "work-registered",
      "Obra marcada como cadastrada",
      manual.work_registered,
      "blocking",
      "manual",
      "Cadastrar a obra na Abramus/UBC",
      "urgent",
    ),
    check(
      "work",
      "work-proof",
      "Comprovante de cadastro conferido",
      manual.work_registration_proof_attached,
      "warning",
      "manual",
      "Anexar ou conferir o comprovante da obra",
    ),

    check(
      "master",
      "master-isrc",
      "ISRC informado",
      hasText(track.isrc),
      "blocking",
      "automatic",
      "Informar o ISRC",
      "urgent",
    ),
    check(
      "master",
      "master-producer",
      "Produtor fonográfico definido",
      masterSplits.some((item) => item.group_type === "phonographic_producer"),
      "blocking",
      "automatic",
      "Definir o produtor fonográfico",
    ),
    check(
      "master",
      "master-split",
      "Split fonográfico fecha 100%",
      closesAtHundred(masterSplits.map((item) => item.percentage)),
      "blocking",
      "automatic",
      "Ajustar o split fonográfico para 100%",
      "urgent",
    ),
    check(
      "master",
      "master-p-line",
      "P-line preenchido",
      hasText(manual.p_line),
      "blocking",
      "manual",
      "Preencher o P-line",
    ),
    check(
      "master",
      "master-c-line",
      "C-line preenchido",
      hasText(manual.c_line),
      "blocking",
      "manual",
      "Preencher o C-line",
    ),
    check(
      "master",
      "master-owner",
      "Master owner definido",
      hasText(manual.master_owner),
      "blocking",
      "manual",
      "Definir o proprietário da master",
    ),

    check(
      "royalties",
      "royalties-split",
      "Split de royalties fecha 100%",
      closesAtHundred(royaltySplits.map((item) => item.percentage)),
      "blocking",
      "automatic",
      "Ajustar o split de royalties para 100%",
      "urgent",
    ),
    check(
      "royalties",
      "royalties-commission",
      "Comissão do selo definida",
      manual.label_commission_percentage !== null,
      "blocking",
      "manual",
      "Definir a comissão do selo",
    ),
    check(
      "royalties",
      "royalties-recoup",
      "Recoup documentado quando aplicável",
      royaltySplits
        .filter((item) => item.recoupable)
        .every((item) => hasText(item.notes)),
      "warning",
      "automatic",
      "Documentar a regra de recoup",
    ),
    check(
      "royalties",
      "royalties-payment-data",
      "Dados de pagamento conferidos",
      manual.payment_data_confirmed ||
        (royaltyEntities.length > 0 &&
          royaltyEntities.length === royaltySplits.length &&
          royaltyEntities.every((entity) => entity?.payment_data_complete)),
      "blocking",
      "manual",
      "Conferir os dados de pagamento dos participantes",
    ),
    check(
      "royalties",
      "royalties-payment-rule",
      "Regra de pagamento definida",
      hasText(manual.payment_rule),
      "blocking",
      "manual",
      "Definir a regra de pagamento",
    ),

    check(
      "contracts",
      "contracts-approved",
      "Contratos assinados e aprovados",
      manual.contracts_approved || hasSignedContract,
      "blocking",
      "manual",
      "Conferir e aprovar os contratos",
      "urgent",
    ),
    check(
      "contracts",
      "contracts-file",
      "Documento contratual anexado",
      hasText(track.contract_url) || hasGeneratedContract,
      "warning",
      "automatic",
      "Anexar o documento contratual",
    ),
    check(
      "contracts",
      "contracts-featured",
      "Contrato do feat aprovado",
      !hasFeaturedArtist || manual.featured_contract_approved,
      "blocking",
      "manual",
      "Aprovar o contrato do feat",
      "urgent",
    ),

    check(
      "distribution",
      "distribution-provider",
      "Distribuidora definida",
      hasText(manual.distributor),
      "blocking",
      "manual",
      "Definir a distribuidora",
    ),
    check(
      "distribution",
      "distribution-release",
      "Release criado na Symphonic/distribuidora",
      manual.symphonic_release_created,
      "warning",
      "manual",
      "Criar o release na distribuidora",
    ),
    check(
      "distribution",
      "distribution-delivered",
      "Release entregue para as lojas",
      manual.delivered_to_stores,
      "warning",
      "manual",
      "Entregar o release para as lojas",
      "low",
    ),
    check(
      "distribution",
      "distribution-published",
      "Lançamento publicado",
      manual.published || track.status === "released",
      "warning",
      "manual",
      "Confirmar a publicação",
      "low",
    ),

    check(
      "files",
      "files-wav",
      "WAV final anexado",
      hasText(track.audio_url),
      "blocking",
      "automatic",
      "Anexar o WAV final",
      "urgent",
    ),
    check(
      "files",
      "files-wav-approved",
      "WAV final aprovado",
      manual.wav_approved,
      "blocking",
      "manual",
      "Aprovar o WAV final",
    ),
    check(
      "files",
      "files-cover",
      "Capa final anexada",
      hasText(track.cover_url),
      "blocking",
      "automatic",
      "Anexar a capa final",
      "urgent",
    ),
    check(
      "files",
      "files-cover-approved",
      "Capa final aprovada",
      manual.cover_approved,
      "blocking",
      "manual",
      "Aprovar a capa final",
    ),
  ];

  const areas = READINESS_AREAS.map((area) =>
    buildArea(
      area,
      checks.filter((item) => item.area === area),
    ),
  );
  const incomplete = checks.filter((item) => !item.complete);
  const blockers = incomplete.filter((item) => item.severity === "blocking");
  const warnings = incomplete.filter((item) => item.severity === "warning");
  const completed = checks.length - incomplete.length;
  const readinessScore =
    checks.length > 0 ? Math.round((completed / checks.length) * 100) : 100;

  const openTask = [...tasks]
    .filter((task) => task.status !== "done")
    .sort(
      (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority],
    )[0];
  const recommendedCheck = [...blockers, ...warnings].sort(
    (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority],
  )[0];
  const nextRecommendedAction = openTask
    ? {
        title: openTask.title,
        responsible:
          openTask.responsible?.trim() ||
          manual.responsible?.trim() ||
          "Não definido",
        priority: openTask.priority,
        area: openTask.area,
        taskId: openTask.id,
      }
    : recommendedCheck
      ? {
          title: recommendedCheck.action,
          responsible: manual.responsible?.trim() || "Não definido",
          priority:
            manual.priority === "medium"
              ? recommendedCheck.priority
              : manual.priority,
          area: recommendedCheck.area,
        }
      : null;

  return {
    isReadyToDistribute: blockers.length === 0,
    readinessScore,
    blockingIssues: blockers.map((item) => item.title),
    warnings: warnings.map((item) => item.title),
    nextRecommendedAction,
    areas,
  };
}
