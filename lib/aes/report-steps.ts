import { MIX_COLUMNS_MATRIX, RCON, S_BOX } from "@/lib/aes/constants";
import { byteToBin, byteToHex, bytesToHex, hexToBytes } from "@/lib/input";
import { DocxReport } from "@/lib/report/docx-report";

export type ReportLogger = (line: string) => void;

type ReductionExplanation =
  | { type: "info"; text: string }
  | { type: "result"; text: string }
  | { type: "strikethrough_xor"; poly1Str: string; poly2Str: string };

export class AesReportRunner {
  constructor(
    private readonly report: DocxReport,
    private readonly log: ReportLogger = console.log,
  ) {}

  run(plaintextHex: string, keyHex: string): { cipherHex: string; roundKeys: string[] } {
    const roundKeys = this.keyScheduleExplain(keyHex);

    this.report.addSpacer(2);
    this.report.addHeading("Ekspansi Round Key", 2);
    this.report.addSpacer();
    this.log(`\n===== RINGKASAN SEMUA ROUND KEY YANG DIHASILKAN =====`);
    roundKeys.forEach((roundKey, index) => {
      this.printMatrix(`Round Key ${index}`, roundKey);
      this.report.addMatrix(`Round Key ${index}`, roundKey);
    });

    this.report.addSpacer(2);
    this.report.addHeading("Proses Enkripsi Block", 2);
    this.report.addSpacer();
    this.log(`\n===== MEMULAI PROSES ENKRIPSI =====`);
    let state = plaintextHex;

    this.report.addSpacer();
    this.report.addHeading("Initial Round (Pre-Round)", 2);
    this.report.addSpacer();
    state = this.addRoundKeyExplain(state, roundKeys[0], 0);

    for (let i = 1; i < 10; i += 1) {
      this.report.addSpacer(2);
      this.report.addHeading(`RONDE ${i}`, 2);
      this.report.addSpacer();
      this.log(`\n===== RONDE ${i} =====`);
      state = this.subBytesExplain(state);
      state = this.shiftRowsExplain(state);
      state = this.mixColumnsPolyExplain(state);
      state = this.addRoundKeyExplain(state, roundKeys[i], i);
    }

    this.report.addSpacer(2);
    this.report.addHeading("RONDE 10 (Final)", 2);
    this.report.addSpacer();
    this.log(`\n===== RONDE 10 (Final) =====`);
    state = this.subBytesExplain(state);
    state = this.shiftRowsExplain(state);
    const textSkip = "Langkah: MixColumns (DILEWATI PADA RONDE FINAL)";
    this.log(`\n--- ${textSkip} ---`);
    this.report.addSpacer();
    this.report.addHeading(textSkip, 3);
    this.report.addSpacer();
    state = this.addRoundKeyExplain(state, roundKeys[10], 10);

    return { cipherHex: state, roundKeys };
  }

  private keyScheduleExplain(initialKeyHex: string): string[] {
    this.log(`\n===== PROSES KEY SCHEDULE (Ekspansi Kunci) =====`);
    this.report.startTwoColumnSection();
    this.report.addHeading("Proses Key Schedule (Ekspansi Kunci)", 2);
    this.report.addSpacer();
    const initialKeyBytes = hexToBytes(initialKeyHex);
    const roundKeysBytes = [initialKeyBytes];
    this.printMatrix("Kunci Awal (Round 0)", initialKeyHex);
    this.report.addMatrix("Kunci Awal (Round 0)", initialKeyHex);

    for (let roundNum = 1; roundNum <= 10; roundNum += 1) {
      this.log(`\n=== Proses Membuat Kunci Round ${roundNum} ===`);
      this.report.addSpacer(2);
      this.report.addHeading(`Membuat Kunci Round ${roundNum}`, 3);
      this.report.addSpacer();
      const prevKey = roundKeysBytes[roundKeysBytes.length - 1];

      const title = "--- 1: Membuat Word Sementara ---";
      this.log(`\n${title}`);
      this.report.addSpacer();
      this.report.addBoldParagraph(title.replace(/^[ -]+|[ -]+$/g, ""));

      let tempWord = prevKey.slice(12, 16);
      let textDoc = `- Kolom terakhir Kunci Round ${roundNum - 1}: ${tempWord.map(byteToHex).join(" ")}`;
      this.log(`  ${textDoc}`);
      this.report.addCalculationParagraph(textDoc);
      tempWord = [...tempWord.slice(1), tempWord[0]];
      textDoc = `- RotWord: ${tempWord.map(byteToHex).join(" ")}`;
      this.log(`  ${textDoc}`);
      this.report.addCalculationParagraph(textDoc);
      tempWord = tempWord.map((byte) => S_BOX[byte]);
      textDoc = `- SubWord (dengan S-BOX): ${tempWord.map(byteToHex).join(" ")}`;
      this.log(`  ${textDoc}`);
      this.report.addCalculationParagraph(textDoc);

      const rconWord = [RCON[roundNum], 0, 0, 0];
      const transformedWord = [...tempWord];
      tempWord = tempWord.map((byte, index) => byte ^ rconWord[index]);

      const t1Combined = `   Word sblm XOR : ${transformedWord.map(byteToHex).join(" ")} (${transformedWord.map(byteToBin).join(" ")})`;
      this.log(`     ${t1Combined}`);
      this.report.addCalculationParagraph(t1Combined);
      const t2Combined = `   Rcon Word[${roundNum}]      : ${rconWord.map(byteToHex).join(" ")} (${rconWord.map(byteToBin).join(" ")})`;
      this.log(`     ${t2Combined}`);
      this.report.addCalculationParagraph(t2Combined);
      this.log("     ----------------------------------------------- (XOR)");
      this.report.addParagraph("   ----------------------------------------------- (XOR)");
      const t3Combined = `   Hasil: ${tempWord.map(byteToHex).join(" ")} (${tempWord.map(byteToBin).join(" ")})`;
      this.log(`     ${t3Combined}`);
      this.report.addCalculationParagraph(t3Combined);

      const newKey = Array(16).fill(0) as number[];
      this.log(`\n--- 2: Menghitung Kolom-Kolom Kunci Baru ---`);
      this.report.addSpacer();
      this.report.addBoldParagraph("\n2: Menghitung Kolom-Kolom Kunci Baru");
      for (let col = 0; col < 4; col += 1) {
        const colDesc = `Menghitung Kolom ${col}`;
        this.log(`\n${colDesc}:`);
        this.report.addBoldParagraph(colDesc);
        for (let i = 0; i < 4; i += 1) {
          let val1: number;
          let val2: number;
          if (col === 0) {
            val1 = prevKey[i];
            val2 = tempWord[i];
          } else {
            const idx = col * 4 + i;
            const prevNewIdx = (col - 1) * 4 + i;
            val1 = prevKey[idx];
            val2 = newKey[prevNewIdx];
          }
          const res = val1 ^ val2;
          newKey[col * 4 + i] = res;

          const combinedText = `Baris ${i}: ${byteToHex(val1)} ⊕ ${byteToHex(val2)} = ${byteToHex(res)} (${byteToBin(val1)} ⊕ ${byteToBin(val2)} = ${byteToBin(res)})`;
          this.log(`  ${combinedText}`);
          this.report.addCalculationParagraph(combinedText);
        }
        if (col < 3) {
          this.printInterimMatrix("Kunci Sementara", newKey, col + 1);
          const interimHex = bytesToHex(newKey.slice(0, (col + 1) * 4)) + "XX".repeat(12 - col * 4);
          this.report.addMatrix("Kunci Sementara", interimHex);
        }
      }
      roundKeysBytes.push(newKey);
      this.printMatrix(`Kunci Round ${roundNum}`, bytesToHex(newKey));
      this.report.addMatrix(`Kunci Round ${roundNum}`, bytesToHex(newKey));
    }
    return roundKeysBytes.map(bytesToHex);
  }

  private subBytesExplain(stateHex: string): string {
    this.log(`\n--- Langkah: SubBytes ---`);
    this.report.addSpacer();
    this.report.addHeading("Langkah: SubBytes", 3);
    this.report.addSpacer();
    const stateBytes = hexToBytes(stateHex);
    for (let i = 0; i < 16; i += 1) {
      const oldVal = stateBytes[i];
      const newVal = S_BOX[oldVal];
      stateBytes[i] = newVal;
      const textDoc = `Byte ${String(i).padStart(2, " ")}: nilai tabel S-BOX pada indeks[${byteToHex(oldVal)}] menjadi ${byteToHex(newVal)}`;
      this.log(`  ${textDoc}`);
      this.report.addCalculationParagraph(textDoc);
    }
    const resultHex = bytesToHex(stateBytes);
    this.printMatrix("Hasil SubBytes", resultHex);
    this.report.addMatrix("Hasil SubBytes", resultHex);
    return resultHex;
  }

  private shiftRowsExplain(stateHex: string): string {
    this.log(`\n--- Langkah: ShiftRows ---`);
    this.report.addSpacer();
    this.report.addHeading("Langkah: ShiftRows", 3);
    this.report.addSpacer();
    const s = hexToBytes(stateHex);
    this.printMatrix("State Sebelum ShiftRows", stateHex);
    this.report.addMatrix("State Sebelum ShiftRows", stateHex);
    const finalS = [...s];
    [finalS[1], finalS[5], finalS[9], finalS[13]] = [s[5], s[9], s[13], s[1]];
    [finalS[2], finalS[6], finalS[10], finalS[14]] = [s[10], s[14], s[2], s[6]];
    [finalS[3], finalS[7], finalS[11], finalS[15]] = [s[15], s[3], s[7], s[11]];
    this.log(`\nPenjelasan pergeseran per baris:`);
    this.report.addParagraph("Penjelasan pergeseran per baris:");
    for (let r = 0; r < 4; r += 1) {
      const before = Array.from({ length: 4 }, (_, c) => s[c * 4 + r]);
      const after = Array.from({ length: 4 }, (_, c) => finalS[c * 4 + r]);
      const textDoc = `- Baris ${r}: ${r === 0 ? "Tidak bergeser" : `Digeser ${r} byte ke kiri`}: ${before.map(byteToHex).join(" ")} menjadi ${after.map(byteToHex).join(" ")}`;
      this.log(`  ${textDoc}`);
      this.report.addCalculationParagraph(textDoc);
    }
    const resultHex = bytesToHex(finalS);
    this.printMatrix("Hasil Akhir ShiftRows", resultHex);
    this.report.addMatrix("Hasil Akhir ShiftRows", resultHex);
    return resultHex;
  }

  private mixColumnsPolyExplain(stateHex: string): string {
    this.log(`\n--- Langkah: MixColumns (Polinomial) ---`);
    this.report.addSpacer();
    this.report.addHeading("Langkah: MixColumns (Polinomial)", 3);
    this.report.addSpacer();
    this.report.addConstantMatrix("Matriks Konstan yang Digunakan:", MIX_COLUMNS_MATRIX);
    this.printConstantMatrix("Matriks Konstan yang Digunakan:", MIX_COLUMNS_MATRIX);

    const stateBytes = hexToBytes(stateHex);
    const newStateBytes = Array(16).fill(0) as number[];

    for (let c = 0; c < 4; c += 1) {
      this.log(`\n==================== Mencampur Kolom ${c} ====================`);
      this.report.addBoldParagraph(`\nMencampur Kolom ${c}:`);
      const sCol = stateBytes.slice(c * 4, c * 4 + 4);
      const resColBytes = Array(4).fill(0) as number[];

      for (let r = 0; r < 4; r += 1) {
        const mRow = MIX_COLUMNS_MATRIX[r];
        this.log(`\n--- Perhitungan untuk Elemen Baru di Baris ${r} ---`);
        this.report.addBoldParagraph(`Perhitungan untuk Elemen Baru di Baris ${r}:`);
        const summaryLine = sCol.map((sVal, i) => `(${byteToHex(sVal)} * ${byteToHex(mRow[i])})`).join(" ⊕ ");
        this.log(`      ${summaryLine}`);
        this.report.addCalculationParagraph(summaryLine);

        const gmulResults: number[] = [];
        for (let i = 0; i < 4; i += 1) {
          const sVal = sCol[i];
          const mVal = mRow[i];
          this.log(`\n  Langkah ${i + 1}: Perkalian ${byteToHex(sVal)} dengan ${byteToHex(mVal)}`);
          this.report.addBoldParagraph(`Langkah ${i + 1}: Perkalian ${byteToHex(sVal)} dengan ${byteToHex(mVal)}`);
          gmulResults.push(this.explainGmulPoly(sVal, mVal));
        }

        const finalByte = gmulResults.reduce((acc, val) => acc ^ val, 0);
        resColBytes[r] = finalByte;
        this.log(`\n--- Penjumlahan (XOR) Semua Hasil untuk Elemen Baru di Baris ${r} ---`);
        const sumStr = gmulResults.map((val) => `(${byteToBin(val)})`).join(" ⊕ ");
        const resultSumStr = `Hasil Akhir Elemen [Kolom:${r}, Baris:${c}] = ${byteToBin(finalByte)} (Heks: ${byteToHex(finalByte)})`;
        this.log(`      ${sumStr}`);
        this.log(`      ${resultSumStr}`);
        this.report.addBoldParagraph("Penjumlahan Hasil (XOR)");
        this.report.addPolyParagraph(sumStr);
        this.report.addPolyParagraph(resultSumStr);
      }

      for (let i = 0; i < 4; i += 1) {
        newStateBytes[c * 4 + i] = resColBytes[i];
      }
    }

    const resultHex = bytesToHex(newStateBytes);
    this.printMatrix("Hasil Akhir MixColumns", resultHex);
    this.report.addMatrix("Hasil Akhir MixColumns", resultHex);
    return resultHex;
  }

  private addRoundKeyExplain(stateHex: string, keyHex: string, roundNum: number): string {
    this.log(`\n--- Langkah: AddRoundKey (Round ${roundNum}) ---`);
    this.report.addSpacer();
    this.report.addHeading(`Langkah: AddRoundKey (Round ${roundNum})`, 3);
    this.report.addSpacer();
    const stateBytes = hexToBytes(stateHex);
    const keyBytes = hexToBytes(keyHex);
    this.printMatrix("State Sebelum", stateHex);
    this.report.addMatrix("State Sebelum", stateHex);
    this.printMatrix("Kunci Round", keyHex);
    this.report.addMatrix("Kunci Round", keyHex);
    this.log(`\nProses XOR per byte:`);
    this.report.addParagraph("Proses XOR per byte:");
    const resultBytes = Array(16).fill(0) as number[];
    for (let i = 0; i < 16; i += 1) {
      const res = stateBytes[i] ^ keyBytes[i];
      resultBytes[i] = res;
      const textDoc = `Byte ${String(i).padStart(2, " ")}: ${byteToHex(stateBytes[i])} ⊕ ${byteToHex(keyBytes[i])} = ${byteToHex(res)} (${byteToBin(stateBytes[i])} ⊕ ${byteToBin(keyBytes[i])} = ${byteToBin(res)})`;
      this.log(`  ${textDoc}`);
      this.report.addCalculationParagraph(textDoc);
    }
    const resultHex = bytesToHex(resultBytes);
    this.printMatrix(`Hasil AddRoundKey Round ${roundNum}`, resultHex);
    this.report.addMatrix(`Hasil AddRoundKey Round ${roundNum}`, resultHex);
    return resultHex;
  }

  private explainGmulPoly(a: number, b: number): number {
    const indentPrefix = "  ";
    const polyAStr = byteToPolyStr(a);
    const polyBStr = byteToPolyStr(b);

    const headerLine1 = `${byteToHex(a)} = ${byteToBin(a)} = ${polyAStr}`;
    const headerLine2 = `${byteToHex(b)} = ${byteToBin(b)} = ${polyBStr}`;
    const headerLine3 = `${byteToHex(a)} * ${byteToHex(b)} = (${polyAStr}) * (${polyBStr})`;
    this.log(`      ${headerLine1}`);
    this.log(`      ${headerLine2}`);
    this.report.addPolyParagraph(`${headerLine1}\n${headerLine2}\n${headerLine3}`);

    const rawProduct = polyMultiply(a, b);
    const productStr = byteToPolyStr(rawProduct);
    const multResultText = `= ${productStr}`;
    this.log(`      ${multResultText}`);
    this.report.addPolyParagraph(multResultText);

    const [finalResult, reductionExplanations] = polyReduce(rawProduct);
    for (const expItem of reductionExplanations) {
      let consoleText = "";
      if (expItem.type === "strikethrough_xor") {
        consoleText = `(${expItem.poly1Str}) ⊕ (${expItem.poly2Str})`;
        this.report.addTermsWithDuplicateStrike(expItem.poly1Str, expItem.poly2Str);
      } else {
        consoleText = expItem.text;
        this.report.addPolyParagraph(consoleText, true);
      }
      this.log(`      ${indentPrefix}${consoleText.trim()}`);
    }

    const finalResultStr = byteToPolyStr(finalResult);
    const finalText = `= ${finalResultStr} (${byteToBin(finalResult)}) (Heks: ${byteToHex(finalResult)})`;
    this.log(`      ${indentPrefix}${finalText}\n`);
    this.report.addPolyParagraph(finalText, true);
    return finalResult;
  }

  printMatrix(label: string, hexString: string): void {
    this.log(`\n${label}`);
    const bytes = hexString.match(/.{1,2}/g) ?? [];
    for (let r = 0; r < 4; r += 1) {
      this.log(`| ${Array.from({ length: 4 }, (_, c) => bytes[c * 4 + r]?.toUpperCase()).join(" | ")} |`);
    }
  }

  private printConstantMatrix(label: string, matrix: readonly (readonly number[])[]): void {
    this.log(`\n${label}`);
    for (let r = 0; r < 4; r += 1) {
      this.log(`| ${matrix[r].map(byteToHex).join(" | ")} |`);
    }
  }

  private printInterimMatrix(label: string, dataBytes: number[], colsFilled: number): void {
    this.log(`\n${label}`);
    for (let r = 0; r < 4; r += 1) {
      const items = Array.from({ length: 4 }, (_, c) => (c < colsFilled ? byteToHex(dataBytes[c * 4 + r]) : "XX"));
      this.log(`| ${items.join(" | ")} |`);
    }
  }
}

export function byteToPolyStr(polyVal: number): string {
  if (polyVal === 0) return "0";
  const terms: string[] = [];
  for (let i = 0; i < bitLength(polyVal); i += 1) {
    if ((polyVal >> i) & 1) {
      if (i === 0) terms.push("1");
      else if (i === 1) terms.push("x");
      else terms.push(`x^${i}`);
    }
  }
  return terms.reverse().join(" + ");
}

function polyMultiply(poly1: number, poly2: number): number {
  let res = 0;
  for (let i = 0; i < 8; i += 1) {
    if ((poly2 >> i) & 1) {
      res ^= poly1 << i;
    }
  }
  return res;
}

function polyReduce(polyInput: number): [number, ReductionExplanation[]] {
  let poly = polyInput;
  const aesPoly = 0x11b;
  const aesPolyForExp = aesPoly & 0xff;

  if (poly < 0x100) return [poly, []];

  const highestPowerTerm = byteToPolyStr(1 << (bitLength(poly) - 1));
  const explanations: ReductionExplanation[] = [
    { type: "info", text: `${highestPowerTerm} perlu direduksi dengan ${byteToPolyStr(aesPolyForExp)}` },
  ];

  while (poly >= 0x100) {
    const highestBitPos = bitLength(poly) - 1;
    const shiftAmount = highestBitPos - 8;
    const reducer = aesPoly << shiftAmount;

    const polyDisplayStr = byteToPolyStr(poly ^ (1 << highestBitPos));
    const reducerDisplayStr = byteToPolyStr(reducer ^ (1 << highestBitPos));

    explanations.push({
      type: "strikethrough_xor",
      poly1Str: polyDisplayStr,
      poly2Str: reducerDisplayStr,
    });

    poly ^= reducer;
    explanations.push({ type: "result", text: `= ${byteToPolyStr(poly)}` });
  }

  return [poly, explanations];
}

function bitLength(value: number): number {
  return value === 0 ? 0 : Math.floor(Math.log2(value)) + 1;
}
