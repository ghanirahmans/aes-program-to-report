import AdmZip from "adm-zip";
import {
  AlignmentType,
  BorderStyle,
  Document,
  FileChild,
  HeadingLevel,
  IParagraphOptions,
  IRunOptions,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const FONT = "Times New Roman";
const TWIPS_PER_INCH = 1440;
const NARROW_MARGIN = 720;
const MATRIX_CELL_WIDTH = 720;
const MATRIX_TABLE_WIDTH = MATRIX_CELL_WIDTH * 4;

type ParagraphChild = TextRun;

function run(text: string, options: Partial<IRunOptions> = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: 24,
    color: "000000",
    ...options,
  });
}

function paragraph(children: ParagraphChild[] | string, options: IParagraphOptions = {}): Paragraph {
  if (typeof children === "string") {
    return new Paragraph({
      children: [run(children)],
      ...options,
    });
  }

  return new Paragraph({
    children,
    ...options,
  });
}

function heading(text: string, level: 1 | 2 | 3): Paragraph {
  const headingMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  } as const;

  return new Paragraph({
    text,
    heading: headingMap[level],
  });
}

function sectionProperties(columnCount?: number) {
  return {
    page: {
      margin: {
        top: NARROW_MARGIN,
        right: NARROW_MARGIN,
        bottom: NARROW_MARGIN,
        left: NARROW_MARGIN,
        header: NARROW_MARGIN,
        footer: NARROW_MARGIN,
        gutter: 0,
      },
    },
    ...(columnCount
      ? {
          type: SectionType.CONTINUOUS,
          column: {
            count: columnCount,
            equalWidth: true,
          },
        }
      : {}),
  };
}

function tableBorders() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
  return { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
}

export class DocxReport {
  private introChildren: FileChild[] = [];
  private bodyChildren: FileChild[] = [];
  private activeChildren = this.introChildren;

  addHeading(text: string, level: 1 | 2 | 3): void {
    this.activeChildren.push(heading(text, level));
  }

  addParagraph(text = ""): void {
    this.activeChildren.push(paragraph(text));
  }

  addSpacer(lines = 1): void {
    for (let i = 0; i < lines; i += 1) {
      this.addParagraph();
    }
  }

  addBoldParagraph(text: string): void {
    this.activeChildren.push(paragraph([run(text, { bold: true })]));
  }

  addCalculationParagraph(text: string, indent = false): void {
    this.activeChildren.push(
      paragraph(text.trim(), {
        indent: indent ? { left: 360 } : undefined,
      }),
    );
  }

  addInputSummary(plaintextText: string, plaintextHex: string, keyText: string, keyHex: string): void {
    this.addHeading(`Tugas Enkripsi AES ${plaintextText}`, 1);
    this.activeChildren.push(
      paragraph([
        run("///\nPlaintext: ", { bold: true }),
        run(`${plaintextText} (${plaintextHex.toUpperCase()})`),
        run("\nKunci: ", { bold: true }),
        run(`${keyText} (${keyHex.toUpperCase()})\n///`),
      ]),
    );
  }

  addPolyParagraph(text: string, indent = false): void {
    const parts = text.split(/(x\^\d+)/);
    const children = parts.map((part) => {
      if (part.startsWith("x^")) {
        const [, exponent] = part.split("^");
        return [
          run("x"),
          run(exponent, { superScript: true }),
        ];
      }

      return [run(part)];
    }).flat();

    this.activeChildren.push(
      paragraph(children, {
        indent: indent ? { left: 360 } : undefined,
      }),
    );
  }

  addTermsWithDuplicateStrike(poly1: string, poly2: string, indent = true): void {
    const terms1 = poly1.split(" + ");
    const terms2 = poly2.split(" + ");
    const duplicates = new Set(terms1.filter((term) => terms2.includes(term)));
    const children: TextRun[] = [];

    const addTerm = (term: string) => {
      const isDuplicate = duplicates.has(term);
      if (term.includes("^")) {
        const [base, exponent] = term.split("^");
        children.push(run(base, { strike: isDuplicate, bold: isDuplicate }));
        children.push(run(exponent, { superScript: true, strike: isDuplicate, bold: isDuplicate }));
      } else {
        children.push(run(term, { strike: isDuplicate, bold: isDuplicate }));
      }
    };

    terms1.forEach((term, index) => {
      addTerm(term);
      if (index < terms1.length - 1) children.push(run(" + "));
    });
    children.push(run(" + "));
    terms2.forEach((term, index) => {
      addTerm(term);
      if (index < terms2.length - 1) children.push(run(" + "));
    });

    this.activeChildren.push(
      paragraph(children, {
        indent: indent ? { left: 360 } : undefined,
      }),
    );
  }

  addMatrix(label: string, hexString: string): void {
    const bytes = hexString.match(/.{1,2}/g) ?? [];
    this.addMatrixRows(label, Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => bytes[c * 4 + r]?.toUpperCase() ?? "")));
  }

  addConstantMatrix(label: string, matrix: readonly (readonly number[])[]): void {
    this.addMatrixRows(label, matrix.map((row) => row.map((value) => value.toString(16).padStart(2, "0").toUpperCase())));
  }

  startTwoColumnSection(): void {
    this.activeChildren = this.bodyChildren;
  }

  async save(docxPath: string): Promise<string> {
    const document = this.buildDocument();
    await mkdir(dirname(docxPath), { recursive: true });
    await writeFile(docxPath, await Packer.toBuffer(document));
    stripDocxMetadata(docxPath);
    return docxPath;
  }

  private addMatrixRows(label: string, rows: string[][]): void {
    this.activeChildren.push(paragraph([run(label, { italics: true })]));
    this.activeChildren.push(
      new Table({
        width: { size: MATRIX_TABLE_WIDTH, type: WidthType.DXA },
        columnWidths: [MATRIX_CELL_WIDTH, MATRIX_CELL_WIDTH, MATRIX_CELL_WIDTH, MATRIX_CELL_WIDTH],
        layout: TableLayoutType.FIXED,
        alignment: AlignmentType.CENTER,
        borders: tableBorders(),
        rows: rows.map(
          (row) =>
            new TableRow({
              children: row.map(
                (cellValue) =>
                  new TableCell({
                    width: { size: MATRIX_CELL_WIDTH, type: WidthType.DXA },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [run(cellValue)],
                      }),
                    ],
                  }),
              ),
            }),
        ),
      }),
    );
    this.addParagraph();
  }

  private buildDocument(): Document {
    return new Document({
      creator: "",
      title: "",
      subject: "",
      description: "",
      keywords: "",
      lastModifiedBy: "",
      revision: 1,
      styles: {
        default: {
          document: {
            run: {
              font: FONT,
              size: 24,
              color: "000000",
            },
          },
        },
        paragraphStyles: [
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { font: FONT, size: 32, bold: true, color: "000000" },
          },
          {
            id: "Heading2",
            name: "Heading 2",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { font: FONT, size: 28, bold: true, color: "000000" },
          },
          {
            id: "Heading3",
            name: "Heading 3",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { font: FONT, size: 24, bold: true, color: "000000" },
          },
        ],
      },
      sections: [
        {
          properties: sectionProperties(),
          children: this.introChildren,
        },
        {
          properties: sectionProperties(2),
          children: this.bodyChildren,
        },
      ],
    });
  }
}

export function convertDocxToPdf(docxPath: string, outputDir: string): string {
  const converter = findExecutable(["libreoffice", "soffice"]);
  if (!converter) {
    throw new Error("LibreOffice tidak ditemukan, PDF tidak bisa dibuat otomatis.");
  }

  const result = spawnSync(converter, ["--headless", "--convert-to", "pdf", "--outdir", outputDir, docxPath], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Gagal mengkonversi DOCX ke PDF.");
  }

  return docxPath.replace(/\.docx$/i, ".pdf");
}

function findExecutable(candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0) {
      const resolved = result.stdout.trim();
      if (resolved && existsSync(resolved)) return resolved;
    }
  }
  return undefined;
}

function stripDocxMetadata(docxPath: string): void {
  const zip = new AdmZip(docxPath);
  const emptyCoreProperties = Buffer.from(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>',
    "utf8",
  );
  const emptyAppProperties = Buffer.from(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"/>',
    "utf8",
  );

  zip.updateFile("docProps/core.xml", emptyCoreProperties);
  zip.updateFile("docProps/app.xml", emptyAppProperties);
  const fixedDate = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));
  for (const entry of zip.getEntries()) {
    entry.header.time = fixedDate;
  }
  zip.writeZip(docxPath);
}
