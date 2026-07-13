import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type {
  ContractSnapshotParty,
  LabelContractSnapshotV1,
} from "./label-contract-types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function printable(
  value: string | null | undefined,
  fallback = "Não informado",
) {
  if (!value?.trim()) return fallback;

  return value
    .normalize("NFC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, "?");
}

function formatPercentage(value: number | null | undefined) {
  if (value === null || value === undefined) return "Não informado";
  return `${Number(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`;
}

function partyIdentity(party: ContractSnapshotParty) {
  const legalName = party.legalName || party.name;
  const publicName = party.name?.trim();
  return publicName &&
    publicName.toLocaleLowerCase("pt-BR") !==
      legalName.toLocaleLowerCase("pt-BR")
    ? `${legalName} (${publicName})`
    : legalName;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Não informada";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00-03:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return printable(value);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function splitLines(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const paragraphs = printable(value).split("\n");
  const lines: string[] = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      return;
    }

    let current = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${current} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  });

  return lines;
}

class ContractWriter {
  private page: PDFPage;
  private y = PAGE_HEIGHT - MARGIN;

  constructor(
    private readonly pdf: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.page = this.addPage();
  }

  private addPage() {
    const page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 12,
      width: PAGE_WIDTH,
      height: 12,
      color: rgb(0.05, 0.22, 0.55),
    });
    this.page = page;
    this.y = PAGE_HEIGHT - MARGIN;
    return page;
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN + 18) this.addPage();
  }

  gap(height = 10) {
    this.y -= height;
  }

  rule() {
    this.ensureSpace(12);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.7,
      color: rgb(0.82, 0.84, 0.88),
    });
    this.y -= 12;
  }

  text(
    value: string,
    options: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      lineHeight?: number;
      indent?: number;
    } = {},
  ) {
    const size = options.size ?? 10;
    const font = options.bold ? this.bold : this.regular;
    const lineHeight = options.lineHeight ?? size * 1.45;
    const indent = options.indent ?? 0;
    const lines = splitLines(value, font, size, CONTENT_WIDTH - indent);
    this.ensureSpace(lines.length * lineHeight + 2);

    lines.forEach((line) => {
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y,
        size,
        font,
        color: options.color ?? rgb(0.12, 0.15, 0.21),
      });
      this.y -= lineHeight;
    });
  }

  heading(value: string) {
    this.gap(4);
    this.text(value.toUpperCase(), {
      size: 10,
      bold: true,
      color: rgb(0.05, 0.22, 0.55),
      lineHeight: 15,
    });
    this.gap(3);
  }

  partyList(title: string, parties: ContractSnapshotParty[]) {
    this.text(`${title}:`, { bold: true });
    if (parties.length === 0) {
      this.text("Nenhum participante informado.", {
        color: rgb(0.42, 0.45, 0.5),
        indent: 12,
      });
      return;
    }

    parties.forEach((party, index) => {
      const details = [
        party.role,
        party.document ? `documento ${party.document}` : null,
        party.percentage !== null
          ? `participação ${formatPercentage(party.percentage)}`
          : null,
        party.ipiCae ? `IPI/CAE ${party.ipiCae}` : null,
        party.rightsSociety ? `associação ${party.rightsSociety}` : null,
        party.recoupable ? "valor sujeito a recoup" : null,
      ].filter(Boolean);
      this.text(
        `${index + 1}. ${partyIdentity(party)} (${details.join("; ") || "qualificação não informada"}).`,
        { indent: 12 },
      );
    });
  }

  finish(contractNumber: string) {
    const pages = this.pdf.getPages();
    pages.forEach((page, index) => {
      page.drawText(printable(contractNumber), {
        x: MARGIN,
        y: 28,
        size: 8,
        font: this.regular,
        color: rgb(0.5, 0.52, 0.57),
      });
      const pageText = `Página ${index + 1} de ${pages.length}`;
      page.drawText(printable(pageText), {
        x: PAGE_WIDTH - MARGIN - this.regular.widthOfTextAtSize(pageText, 8),
        y: 28,
        size: 8,
        font: this.regular,
        color: rgb(0.5, 0.52, 0.57),
      });
    });
  }
}

function uniqueParties(snapshot: LabelContractSnapshotV1) {
  const all = [
    ...snapshot.participants,
    ...snapshot.work.composers,
    ...snapshot.master.participants,
    ...snapshot.royalties.participants,
  ];
  const seen = new Set<string>();
  return all.filter((party) => {
    const key = `${party.document ?? ""}:${party.legalName ?? party.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function generateLabelContractPdf(
  snapshot: LabelContractSnapshotV1,
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const writer = new ContractWriter(pdf, regular, bold);
  const trackTitle = printable(snapshot.track.title);
  const parties = uniqueParties(snapshot);

  pdf.setTitle(`Contrato - ${trackTitle}`);
  pdf.setAuthor(printable(snapshot.workspace.name));
  pdf.setSubject(
    "Autorização, liberação e divisão de royalties para distribuição musical",
  );
  pdf.setCreator("Music Business OS - Label OS");
  pdf.setCreationDate(new Date(snapshot.generatedAt));

  writer.text(
    "CONTRATO DE AUTORIZAÇÃO, LIBERAÇÃO E DIVISÃO DE ROYALTIES PARA DISTRIBUIÇÃO MUSICAL",
    { size: 15, bold: true, lineHeight: 20 },
  );
  writer.gap(5);
  writer.text(`Instrumento nº ${snapshot.contractNumber}`, {
    size: 9,
    color: rgb(0.38, 0.41, 0.47),
  });
  writer.rule();

  writer.text(
    `Pelo presente instrumento, as partes abaixo identificadas registram os termos de autorização, liberação e divisão econômica relativos à obra e ao fonograma "${trackTitle}", para fins de distribuição musical pela operação ${printable(snapshot.workspace.name)}.`,
  );
  writer.gap();
  writer.partyList("Partes e participantes", parties);

  writer.heading("1. Identificação da faixa");
  writer.text(
    `Título: ${trackTitle}. Versão: ${printable(snapshot.track.version)}. Artista(s) principal(is): ${printable(snapshot.artists.primary.join(", "), "Não informado")}. Feat(s): ${printable(snapshot.artists.featured.join(", "), "Não informado")}. ISRC: ${printable(snapshot.track.isrc)}. UPC: ${printable(snapshot.track.upc)}. Data de lançamento: ${formatDate(snapshot.track.releaseDate)}. Gênero: ${printable(snapshot.track.genre)}.`,
  );

  writer.heading("2. Obra musical e direitos autorais");
  writer.text(
    `A obra está marcada no sistema como ${snapshot.work.registered ? "cadastrada" : "não cadastrada"}. Associação ou sociedade informada: ${printable(snapshot.work.registrationSociety)}. Comprovante cadastral: ${snapshot.work.proofAttached ? "anexado" : "não anexado"}.`,
  );
  writer.partyList("Compositores e divisão autoral", snapshot.work.composers);

  writer.heading("3. Fonograma e master");
  writer.text(
    `Proprietário da master: ${printable(snapshot.master.owner)}. P-line: ${printable(snapshot.master.pLine)}. C-line: ${printable(snapshot.master.cLine)}.`,
  );
  writer.partyList(
    "Participantes e divisão fonográfica",
    snapshot.master.participants,
  );

  writer.heading("4. Royalties, comissão e recoup");
  writer.partyList(
    "Divisão de royalties acordada",
    snapshot.royalties.participants,
  );
  writer.text(
    `Comissão do selo: ${formatPercentage(snapshot.royalties.labelCommissionPercentage)}. Regra de pagamento: ${printable(snapshot.royalties.paymentRule)}. Os valores recoupáveis, quando indicados na relação acima, serão compensados antes da distribuição líquida conforme a regra operacional acordada entre as partes.`,
  );

  writer.heading("5. Autorização e distribuição");
  writer.text(
    `As partes autorizam o uso, reprodução, disponibilização, comunicação pública e distribuição digital da obra e do fonograma nos territórios e serviços operados pela distribuidora ${printable(snapshot.distribution.distributor)}, respeitadas as participações indicadas neste instrumento. A autorização não transfere direitos além do necessário à distribuição e exploração autorizada da faixa.`,
  );

  writer.heading("6. Declarações");
  writer.text(
    "Cada participante declara que os dados fornecidos são verdadeiros, que possui capacidade para autorizar sua participação e que comunicará eventual conflito de titularidade. As partes reconhecem que este documento registra o snapshot dos dados existentes no Label OS na data de geração e não é alterado por edições posteriores da track.",
  );

  writer.heading("7. Vigência e formalização");
  writer.text(
    `Este instrumento entra em vigor após a concordância das partes e permanece válido enquanto a faixa estiver em exploração, salvo ajuste escrito posterior. Responsável operacional informado: ${printable(snapshot.responsible)}. Observações: ${printable(snapshot.observations, "Sem observações")}.`,
  );

  writer.gap(18);
  writer.text(
    `${printable(snapshot.workspace.name)}, ${formatDate(snapshot.generatedAt)}.`,
  );
  writer.gap(24);
  writer.rule();
  writer.text("RESPONSÁVEL PELA OPERAÇÃO", { size: 8, bold: true });
  writer.text(printable(snapshot.responsible ?? snapshot.generatedBy.name), {
    size: 9,
  });

  parties.forEach((party) => {
    writer.gap(20);
    writer.rule();
    writer.text(printable(partyIdentity(party)), {
      size: 9,
      bold: true,
    });
    writer.text(`Participação: ${printable(party.role)}`, { size: 8 });
  });

  writer.finish(snapshot.contractNumber);
  return pdf.save();
}
