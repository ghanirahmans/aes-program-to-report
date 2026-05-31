import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { AesReportRunner, ReportLogger } from "@/lib/aes/report-steps";
import { byteToBin, parseAesBlockInput, sanitizeFilename } from "@/lib/input";
import { convertDocxToPdf, DocxReport } from "@/lib/report/docx-report";

export type GenerateReportOptions = {
  plaintext: string;
  key: string;
  outputRoot?: string;
  logger?: ReportLogger;
  timestamp?: Date;
};

export type GenerateReportResult = {
  plaintextText: string;
  plaintextHex: string;
  keyText: string;
  keyHex: string;
  cipherHex: string;
  binary: string;
  outputDir: string;
  docxPath: string;
  pdfPath: string;
};

export async function generateAesReport(options: GenerateReportOptions): Promise<GenerateReportResult> {
  const logger = options.logger ?? console.log;
  const plaintext = parseAesBlockInput(options.plaintext, "Plaintext");
  const key = parseAesBlockInput(options.key, "Kunci");
  const timestamp = formatTimestamp(options.timestamp ?? new Date());
  const outputName = `Enkripsi_AES_${sanitizeFilename(plaintext.text)}_${timestamp}`;
  const outputDir = join(options.outputRoot ?? ".", outputName);
  const docxPath = join(outputDir, `${outputName}.docx`);

  await mkdir(outputDir, { recursive: true });

  const report = new DocxReport();
  report.addInputSummary(plaintext.text, plaintext.hex, key.text, key.hex);
  report.addSpacer();

  logger(`\n--- Verifikasi Input ---`);
  logger(`Plaintext '${plaintext.text}' dikonversi menjadi Heks: ${plaintext.hex.toUpperCase()}`);
  logger(`Kunci '${key.text}' dikonversi menjadi Heks: ${key.hex.toUpperCase()}`);

  const runner = new AesReportRunner(report, logger);
  const { cipherHex } = runner.run(plaintext.hex, key.hex);

  report.addSpacer(2);
  report.addHeading("Hasil Akhir", 1);
  logger(`\n===== PROSES SELESAI =====`);
  runner.printMatrix("Ciphertext Akhir", cipherHex);
  report.addMatrix("Ciphertext Akhir", cipherHex);

  const finalBytes = cipherHex.match(/.{1,2}/g)?.map((hex) => Number.parseInt(hex, 16)) ?? [];
  const binary = finalBytes.map(byteToBin).join(" ");

  logger(`\nRingkasan Hasil Akhir:`);
  logger(`  Ciphertext (Hex): ${cipherHex.toUpperCase()}`);
  logger(`  Biner               : ${binary}`);

  report.addSpacer();
  report.addCalculationParagraph(`Ciphertext (Heksadesimal): ${cipherHex.toUpperCase()}`);
  report.addCalculationParagraph(`Representasi Biner: ${binary}`);

  await report.save(docxPath);
  const pdfPath = convertDocxToPdf(docxPath, outputDir);

  return {
    plaintextText: plaintext.text,
    plaintextHex: plaintext.hex,
    keyText: key.text,
    keyHex: key.hex,
    cipherHex,
    binary,
    outputDir,
    docxPath,
    pdfPath,
  };
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}
