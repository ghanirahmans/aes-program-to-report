"use client";

import { useState } from "react";
import { simulateTokenPurchase } from "../actions";
import Link from "next/link";

/**
 * BuyTokenPage component.
 * Allows users to simulate checking out and purchasing an AES license token.
 * Generates tokens in real time on the server, logs email delivery, and presents
 * the token with single-click clipboard copying.
 */
export default function BuyTokenPage() {
  const [email, setEmail] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<{
    success: boolean;
    token?: string;
    error?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleBuy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@") || email.length < 5) {
      alert("Silakan masukkan email yang valid.");
      return;
    }

    setIsProcessing(true);
    setPurchaseResult(null);
    setCopied(false);

    try {
      const res = await simulateTokenPurchase(email);
      setPurchaseResult(res);
    } catch (err) {
      setPurchaseResult({
        success: false,
        error: "Terjadi gangguan jaringan saat memproses token.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (purchaseResult?.token) {
      navigator.clipboard.writeText(purchaseResult.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: "600px", marginTop: "1rem" }}>
      <header className="header">
        <h1>Beli Token Lisensi</h1>
        <p>
          Simulasikan pembelian lisensi program. Token akan dihasilkan secara instan,
          dikirim ke email pembeli, dan ditampilkan langsung pada layar ini.
        </p>
      </header>

      {!purchaseResult?.success ? (
        <section className="card" style={{ animation: "fadeIn 0.3s ease" }}>
          <form onSubmit={handleBuy} className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="input-group">
              <label className="label-text" htmlFor="email-checkout">
                Alamat Email Pembeli
              </label>
              <div className="input-wrapper">
                <input
                  id="email-checkout"
                  type="email"
                  required
                  placeholder="buyer@example.com"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
              <span className="status-badge" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Email ini digunakan untuk mengirimkan salinan token secara resmi.
              </span>
            </div>

            <div className="package-preview" style={{
              background: "rgba(0, 0, 0, 0.25)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
              borderRadius: "8px",
              padding: "1.1rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h4 style={{ color: "#ffffff", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.15rem" }}>
                  1x AES Encryption Token
                </h4>
                <p style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  Lisensi sekali pakai untuk memproses 1x simulasi & unduhan laporan
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ color: "var(--accent-cyan)", fontWeight: 700, fontSize: "1.1rem" }}>
                  Rp 15.000
                </span>
              </div>
            </div>

            <div className="button-container" style={{ marginTop: "0.5rem" }}>
              <button
                type="submit"
                className="btn-process"
                style={{ width: "100%", justifyContent: "center" }}
                disabled={isProcessing || !email.includes("@")}
              >
                {isProcessing ? (
                  <>
                    <svg
                      style={{ animation: "spin 1s linear infinite", width: 16, height: 16 }}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Menghubungi Payment Gateway...</span>
                  </>
                ) : (
                  <span>Bayar & Generate Token</span>
                )}
              </button>
            </div>
            
            {purchaseResult?.error && (
              <div style={{
                background: "rgba(244, 63, 94, 0.08)",
                border: "1px solid var(--accent-red)",
                color: "var(--accent-red)",
                borderRadius: "6px",
                padding: "0.75rem",
                fontSize: "0.8rem",
                textAlign: "center"
              }}>
                ❌ {purchaseResult.error}
              </div>
            )}
          </form>
        </section>
      ) : (
        <section className="card" style={{
          border: "1px solid var(--accent-emerald)",
          boxShadow: "0 0 25px rgba(16, 185, 129, 0.08)",
          animation: "fadeIn 0.4s ease"
        }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem" }}>
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
              <h3 style={{ color: "#ffffff", fontSize: "1.2rem", fontWeight: 700 }}>Simulasi Pembayaran Berhasil!</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "0.25rem" }}>
                Token lisensi aman telah di-generate dan dikirim ke <strong style={{ color: "#ffffff" }}>{email}</strong>.
              </p>
            </div>

            <div style={{
              background: "rgba(0, 0, 0, 0.35)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
              borderRadius: "8px",
              padding: "1.25rem",
              margin: "0.5rem 0",
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
                {purchaseResult.token}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                Simpan token ini. Token bersifat sekali pakai dan wajib dimasukkan pada form visualizer sebelum melakukan proses enkripsi AES.
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "0.25rem" }}>
              <button onClick={handleCopy} className="btn-process" style={{
                padding: "0.6rem 1.25rem",
                fontSize: "0.85rem",
                background: copied ? "var(--accent-emerald)" : "#ffffff",
                color: copied ? "#ffffff" : "#080b11",
                boxShadow: "none"
              }}>
                {copied ? "✓ Tersalin!" : "Salin Token"}
              </button>
              
              <Link href="/" className="btn-download" style={{
                padding: "0.6rem 1.25rem",
                fontSize: "0.85rem",
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none"
              }}>
                Gunakan Enkripsi
              </Link>
            </div>
            
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255, 255, 255, 0.03)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
              📧 Salinan email pengiriman tersimpan di: <code style={{ color: "var(--accent-purple)", fontFamily: "JetBrains Mono" }}>scratch/sent-emails.log</code>
            </p>
          </div>
        </section>
      )}

      {/* Styles for spinner animations */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
