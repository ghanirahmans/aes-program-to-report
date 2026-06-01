"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyMidtransPayment } from "../../actions";

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id") || "";
  const queryEmail = searchParams.get("email") || "";
  const [isVerifying, setIsVerifying] = useState(true);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    token?: string;
    email?: string;
    error?: string;
    alreadyProcessed?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!orderId) {
      setIsVerifying(false);
      setResult({
        success: false,
        error: "Order ID tidak ditemukan pada parameter URL.",
      });
      return;
    }

    const runVerification = async () => {
      try {
        const res = await verifyMidtransPayment(orderId, queryEmail);
        setResult(res);
      } catch (err) {
        setResult({
          success: false,
          error: "Gagal menghubungkan ke server untuk verifikasi.",
        });
      } finally {
        setIsVerifying(false);
      }
    };

    runVerification();
  }, [orderId, queryEmail]);

  const handleCopy = () => {
    if (result?.token) {
      navigator.clipboard.writeText(result.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isVerifying) {
    return (
      <section className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center" }}>
          <svg
            style={{ animation: "spin 1s linear infinite", width: 40, height: 40, color: "var(--accent-cyan)" }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div>
            <h3 style={{ color: "#ffffff", fontSize: "1.25rem", fontWeight: 700 }}>Memverifikasi Pembayaran Anda</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.35rem" }}>
              Sistem sedang menanyakan status transaksi aman Anda langsung ke Midtrans API...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!result || !result.success) {
    return (
      <section className="card" style={{ border: "1px solid var(--accent-red)", boxShadow: "0 0 20px rgba(244, 63, 94, 0.05)" }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "rgba(244, 63, 94, 0.08)",
            border: "1px solid var(--accent-red)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto"
          }}>
            <span style={{ fontSize: "1.5rem" }}>❌</span>
          </div>
          <div>
            <h3 style={{ color: "#ffffff", fontSize: "1.2rem", fontWeight: 700 }}>Verifikasi Pembayaran Gagal</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.35rem", lineHeight: 1.4 }}>
              {result?.error || "Status pembayaran Anda belum dikonfirmasi oleh Midtrans."}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "0.5rem" }}>
            <Link href="/buy-token" className="btn-process" style={{ textDecoration: "none" }}>
              Coba Lagi
            </Link>
            <Link href="/" className="btn-download" style={{ textDecoration: "none" }}>
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Success case
  return (
    <section className="card" style={{
      border: "1px solid var(--accent-emerald)",
      boxShadow: "0 0 25px rgba(16, 185, 129, 0.08)",
      animation: "fadeIn 0.4s ease"
    }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "rgba(16, 185, 129, 0.08)",
          border: "1px solid var(--accent-emerald)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto"
        }}>
          <svg style={{ width: 22, height: 22, color: "var(--accent-emerald)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h3 style={{ color: "#ffffff", fontSize: "1.25rem", fontWeight: 700 }}>Pembayaran Midtrans Sukses!</h3>
          {result.alreadyProcessed ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.35rem", lineHeight: 1.4 }}>
              Transaksi Anda untuk order <strong style={{ color: "#ffffff" }}>{orderId}</strong> telah berhasil diproses secara otomatis oleh Webhook kami. Token aman telah dikirimkan ke <strong style={{ color: "var(--accent-cyan)" }}>{result.email}</strong>.
            </p>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.35rem", lineHeight: 1.4 }}>
              Pembayaran Anda berhasil dikonfirmasi secara real-time! Token lisensi aman Anda telah dikirim ke <strong style={{ color: "var(--accent-cyan)" }}>{result.email}</strong> dan juga ditampilkan di bawah ini.
            </p>
          )}
        </div>

        {/* Display token only if we generated it just now. If already processed, they copy it from their email */}
        {!result.alreadyProcessed && result.token ? (
          <div style={{
            background: "rgba(0, 0, 0, 0.35)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderRadius: "8px",
            padding: "1.25rem",
            margin: "0.25rem 0",
          }}>
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
              KUNCI TOKEN LISENSI ANDA
            </span>
            <div style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "1.6rem",
              fontWeight: 700,
              color: "var(--accent-cyan)",
              letterSpacing: "0.08em",
              margin: "0.6rem 0"
            }}>
              {result.token}
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
              Simpan token lisensi sekali pakai ini untuk visualisasi enkripsi AES.
            </p>
          </div>
        ) : (
          <div style={{
            background: "rgba(16, 185, 129, 0.04)",
            border: "1px solid rgba(16, 185, 129, 0.15)",
            borderRadius: "8px",
            padding: "1.25rem",
            margin: "0.25rem 0",
            textAlign: "left"
          }}>
            <h4 style={{ color: "#ffffff", fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              Token Dikirim ke Email Anda
            </h4>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
              Sistem keamanan kami telah mengirimkan token lisensi komplit langsung ke alamat email Anda (<strong style={{ color: "#ffffff" }}>{result.email}</strong>). Silakan periksa <strong>kotak masuk</strong> atau <strong>folder spam/promosi</strong> email Anda untuk menyalin token tersebut.
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "0.25rem" }}>
          {!result.alreadyProcessed && result.token && (
            <button onClick={handleCopy} className="btn-process" style={{
              padding: "0.6rem 1.25rem",
              fontSize: "0.85rem",
              background: copied ? "var(--accent-emerald)" : "#ffffff",
              color: copied ? "#ffffff" : "#080b11",
              boxShadow: "none"
            }}>
              {copied ? "✓ Tersalin!" : "Salin Token"}
            </button>
          )}

          <Link href="/" className="btn-download" style={{
            padding: "0.6rem 1.25rem",
            fontSize: "0.85rem",
            display: "inline-flex",
            alignItems: "center",
            textDecoration: "none"
          }}>
            Kembali ke Dashboard Enkripsi
          </Link>
        </div>

        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255, 255, 255, 0.03)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
          📧 Salinan log email transaksi tersimpan di: <code style={{ color: "var(--accent-purple)", fontFamily: "JetBrains Mono" }}>scratch/sent-emails.log</code>
        </p>
      </div>
    </section>
  );
}

export default function SuccessPage() {
  return (
    <div className="app-container" style={{ maxWidth: "650px", marginTop: "3rem" }}>
      <header className="header" style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1>Status Transaksi Lisensi</h1>
        <p>Verifikasi pembayaran aman secara real-time melalui sistem otentikasi Midtrans.</p>
      </header>

      <Suspense fallback={
        <section className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center" }}>
            <svg
              style={{ animation: "spin 1s linear infinite", width: 40, height: 40, color: "var(--accent-cyan)" }}
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div>
              <h3 style={{ color: "#ffffff", fontSize: "1.25rem", fontWeight: 700 }}>Memuat Halaman...</h3>
            </div>
          </div>
        </section>
      }>
        <SuccessPageContent />
      </Suspense>
    </div>
  );
}
