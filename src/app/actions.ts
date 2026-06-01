"use server";

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { generateAesReport } from "@/lib/generate-report";
import { createLicenseAfterPayment } from "@/lib/license";
import crypto from "crypto";
import { convertDocxToPdf } from "@/lib/report/docx-report";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import AdmZip from "adm-zip";

export interface AesActionResult {
  success: boolean;
  logs?: string[];
  docxBase64?: string;
  pdfBase64?: string;
  zipBase64?: string;
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
    // Generate both DOCX and PDF reports dynamically in the background for instant downloads
    const result = await generateAesReport({
      plaintext,
      key,
      outputRoot: "./tmp_reports",
      logger,
      generatePdf: true, // Generate PDF automatically
    });

    let docxBase64 = "";
    let pdfBase64 = "";
    let zipBase64 = "";

    try {
      const docxBuf = await fs.readFile(result.docxPath);
      docxBase64 = docxBuf.toString("base64");
    } catch (err) {
      console.error("Gagal membaca berkas DOCX:", err);
    }

    if (result.pdfPath) {
      try {
        const pdfBuf = await fs.readFile(result.pdfPath);
        pdfBase64 = pdfBuf.toString("base64");
      } catch (err) {
        console.error("Gagal membaca berkas PDF:", err);
      }
    }

    // Generate ZIP containing both files under descriptive filenames before cleaning up the directory
    try {
      const zip = new AdmZip();
      const cleanPlaintext = plaintext.replace(/[^A-Za-z0-9]/g, "_") || "AES";
      const docxName = `Laporan_AES_${cleanPlaintext}.docx`;
      const pdfName = `Laporan_AES_${cleanPlaintext}.pdf`;
      
      zip.addLocalFile(result.docxPath, undefined, docxName);
      if (result.pdfPath) {
        zip.addLocalFile(result.pdfPath, undefined, pdfName);
      }
      
      const zipBuf = zip.toBuffer();
      zipBase64 = zipBuf.toString("base64");
    } catch (zipErr) {
      console.error("Gagal membuat arsip ZIP:", zipErr);
    }

    // Clean up temporary workspace immediately
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
      zipBase64,
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

export async function convertDocxToPdfAction(docxBase64: string): Promise<{ success: boolean; pdfBase64?: string; error?: string }> {
  try {
    if (!docxBase64) {
      return { success: false, error: "Data berkas Word tidak valid." };
    }

    const docxBuf = Buffer.from(docxBase64, "base64");

    // Create a temporary workspace for the conversion
    const tempDir = join("./tmp_reports", `pdf_conv_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
    await fs.mkdir(tempDir, { recursive: true });

    const tempDocxPath = join(tempDir, "document.docx");
    await fs.writeFile(tempDocxPath, docxBuf);

    // Call our ultra-optimized convertDocxToPdf using only ~20MB RSS peak RAM
    const tempPdfPath = convertDocxToPdf(tempDocxPath, tempDir);

    const pdfBuf = await fs.readFile(tempPdfPath);
    const pdfBase64 = pdfBuf.toString("base64");

    // Clean up temporary workspace asynchronously
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error("Gagal membersihkan folder konversi temporer:", cleanupErr);
    }

    return {
      success: true,
      pdfBase64,
    };
  } catch (error: unknown) {
    console.error("Gagal melakukan konversi PDF on-demand:", error);
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

export async function verifyMidtransPayment(orderId: string, queryEmail?: string): Promise<{ success: boolean; token?: string; email?: string; error?: string; alreadyProcessed?: boolean }> {
  try {
    if (!orderId) {
      return { success: false, error: "Order ID tidak valid." };
    }

    // 1. Check if order already processed in database
    const existing = await prisma.license.findUnique({
      where: { orderId }
    });

    if (existing) {
      return {
        success: true,
        alreadyProcessed: true,
        email: existing.email,
      };
    }

    // 2. Fetch the real settlement status directly from Midtrans Sandbox API using basic auth
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      return { success: false, error: "Midtrans Server Key belum dikonfigurasi di server." };
    }

    const authHeader = Buffer.from(`${serverKey}:`).toString("base64");
    const response = await fetch(`https://api.sandbox.midtrans.com/v2/${orderId}/status`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return { success: false, error: "Gagal memverifikasi status pembayaran ke Midtrans." };
    }

    const data = await response.json();
    const successStatuses = ["settlement", "capture"];

    if (successStatuses.includes(data.transaction_status)) {
      // Payment is settled! Let's generate the token on the spot
      const email = data.customer_details?.email || queryEmail || "";
      if (!email) {
        return { success: false, error: "Email pembeli tidak ditemukan di detail transaksi Midtrans maupun di parameter URL." };
      }

      // Generate the token securely (inserts hash in DB + emails raw token to customer!)
      const rawToken = await createLicenseAfterPayment({
        email,
        orderId,
      });

      return {
        success: true,
        token: rawToken,
        email,
        alreadyProcessed: false,
      };
    } else {
      return {
        success: false,
        error: `Pembayaran belum selesai. Status transaksi: ${data.transaction_status || "unknown"}`
      };
    }
  } catch (error: any) {
    console.error("[Action Error] verifyMidtransPayment failed:", error);
    return {
      success: false,
      error: error.message || "Terjadi kesalahan sistem saat memverify pembayaran."
    };
  }
}

export async function createMidtransTransaction(email: string): Promise<{ success: boolean; redirectUrl?: string; error?: string }> {
  try {
    if (!email || !email.includes("@") || email.length < 5) {
      return { success: false, error: "Masukkan email yang valid." };
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      return { success: false, error: "Midtrans Server Key belum dikonfigurasi di server." };
    }

    // Generate a cryptographically secure unique order ID
    const orderId = `ORD-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const authHeader = Buffer.from(`${serverKey}:`).toString("base64");

    // Dynamically resolve the absolute host/origin to construct correct callbacks
    let host = "localhost:3000";
    try {
      const headersList = await headers();
      host = headersList.get("host") || "localhost:3000";
    } catch (e) {
      console.warn("Could not get host from headers, using default localhost:3000", e);
    }
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    const origin = `${protocol}://${host}`;
    
    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: 15000, // Rp 15.000 for 1 token
      },
      customer_details: {
        email: email,
      },
      credit_card: {
        secure: true
      },
      callbacks: {
        finish: `${origin}/buy-token/success?email=${encodeURIComponent(email)}`,
        unfinish: `${origin}/buy-token`,
        error: `${origin}/buy-token`
      }
    };

    const response = await fetch("https://app.sandbox.midtrans.com/snap/v1/transactions", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Midtrans Snap Error]", errText);
      return { success: false, error: "Gagal membuat sesi pembayaran dengan Midtrans." };
    }

    const data = await response.json();
    if (!data.redirect_url) {
      return { success: false, error: "Midtrans tidak mengembalikan URL pembayaran." };
    }

    return {
      success: true,
      redirectUrl: data.redirect_url,
    };
  } catch (error: any) {
    console.error("[Action Error] createMidtransTransaction failed:", error);
    return {
      success: false,
      error: error.message || "Terjadi kesalahan sistem saat menghubungi payment gateway."
    };
  }
}
