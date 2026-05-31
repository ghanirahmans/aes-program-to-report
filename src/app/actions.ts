"use server";

import { promises as fs } from "node:fs";
import { generateAesReport } from "@/lib/generate-report";
import { createLicenseAfterPayment } from "@/lib/license";

export interface AesActionResult {
  success: boolean;
  logs?: string[];
  docxBase64?: string;
  pdfBase64?: string;
  cipherHex?: string;
  binary?: string;
  error?: string;
}

export async function processAes(plaintext: string, key: string): Promise<AesActionResult> {
  const logs: string[] = [];
  const logger = (line: string) => {
    logs.push(line);
  };

  try {
    const result = await generateAesReport({
      plaintext,
      key,
      outputRoot: "./tmp_reports",
      logger,
    });

    let docxBase64 = "";
    try {
      const docxBuf = await fs.readFile(result.docxPath);
      docxBase64 = docxBuf.toString("base64");
    } catch (err) {
      console.error("Gagal membaca berkas DOCX:", err);
    }

    let pdfBase64 = "";
    try {
      const pdfBuf = await fs.readFile(result.pdfPath);
      pdfBase64 = pdfBuf.toString("base64");
    } catch (err) {
      console.error("Gagal membaca berkas PDF:", err);
    }

    // Bersihkan folder output sementara agar tidak membebani server
    try {
      await fs.rm(result.outputDir, { recursive: true, force: true });
    } catch (err) {
      console.error("Gagal membersihkan direktori temporer:", err);
    }

    return {
      success: true,
      logs,
      docxBase64,
      pdfBase64,
      cipherHex: result.cipherHex,
      binary: result.binary,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Simulates a successful checkout purchase from the frontend.
 * Directly invokes the license creation service (database insert + email dispatch)
 * without requiring the payment gateway HMAC signature check.
 * 
 * @param email Buyer email address
 * @returns Object with success status, raw license token, or error
 */
export async function simulateTokenPurchase(email: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    if (!email || !email.includes('@') || email.length < 5) {
      return { success: false, error: 'Masukkan email yang valid.' };
    }

    const simulatedOrderId = `SIM-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Call database license service directly from the server context
    const token = await createLicenseAfterPayment({
      email: email,
      orderId: simulatedOrderId,
    });

    return {
      success: true,
      token,
    };
  } catch (error: any) {
    console.error('[Action Error] simulateTokenPurchase failed:', error);
    return {
      success: false,
      error: error.message || 'Terjadi kesalahan sistem saat memproses token.',
    };
  }
}
