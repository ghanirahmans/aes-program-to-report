"use client";

import { useState } from "react";
import { simulateTokenPurchase, createMidtransTransaction } from "../actions";
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
  const [isMidtransProcessing, setIsMidtransProcessing] = useState(false);

  const handleBuy = async () => {
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

  const handleMidtransPay = async () => {
    if (!email || !email.includes("@") || email.length < 5) {
      alert("Silakan masukkan email yang valid.");
      return;
    }

    setIsMidtransProcessing(true);
    try {
      const res = await createMidtransTransaction(email);
      if (res.success && res.redirectUrl) {
        // Redirect the user to the dynamically generated unique Midtrans Sandbox checkout URL!
        window.location.href = res.redirectUrl;
      } else {
        alert(res.error || "Gagal membuat sesi pembayaran dengan Midtrans.");
      }
    } catch (err) {
      alert("Terjadi gangguan jaringan saat menghubungi Midtrans.");
    } finally {
      setIsMidtransProcessing(false);
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
          Beli token lisensi resmi sekali pakai untuk melakukan visualisasi enkripsi AES dan mengunduh laporan perhitungan tugas Anda.
        </p>
      </header>

      {!purchaseResult?.success ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Consolidated Email Input Card */}
          <section className="card" style={{ animation: "fadeIn 0.3s ease", padding: "1.25rem" }}>
            <div className="input-group" style={{ margin: 0 }}>
              <label className="label-text" htmlFor="email-checkout" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Alamat Email Anda
              </label>
              <div className="input-wrapper" style={{ marginTop: "0.4rem" }}>
                <input
                  id="email-checkout"
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isProcessing || isMidtransProcessing}
                />
              </div>
              <span className="status-badge" style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.4rem", display: "inline-block" }}>
                Email ini wajib diisi secara valid karena digunakan untuk mengirimkan token lisensi Anda.
              </span>
            </div>
          </section>

          {/* Official Midtrans Payment Gateway Section */}
          <section className="card" style={{
            border: "1px solid rgba(6, 182, 212, 0.3)",
            boxShadow: "0 0 20px rgba(6, 182, 212, 0.05)",
            background: "linear-gradient(to bottom, rgba(8, 11, 17, 0.8), rgba(6, 182, 212, 0.02))",
            animation: "fadeIn 0.3s ease"
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{
                  background: "rgba(6, 182, 212, 0.08)",
                  border: "1px solid var(--accent-cyan)",
                  color: "var(--accent-cyan)",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "4px",
                  textTransform: "uppercase"
                }}>
                  Rekomendasi (Resmi)
                </span>
                <span style={{ color: "var(--accent-cyan)", fontWeight: 700, fontSize: "1.1rem" }}>
                  Rp 15.000
                </span>
              </div>

              <div>
                <h3 style={{ color: "#ffffff", fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  Metode Pembayaran Midtrans Snap (Sesi Unik)
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", lineHeight: 1.4 }}>
                  Buat sesi pembayaran aman instan di mana Midtrans akan men-generate QRIS, GoPay, ShopeePay, Transfer Bank, dll. unik untuk Anda.
                </p>
              </div>

              <div className="button-container" style={{ marginTop: "0.25rem" }}>
                <button
                  type="button"
                  onClick={handleMidtransPay}
                  className="btn-process"
                  style={{ width: "100%", justifyContent: "center", display: "inline-flex", gap: "0.5rem" }}
                  disabled={isProcessing || isMidtransProcessing || !email.includes("@")}
                >
                  {isMidtransProcessing ? (
                    <>
                      <svg
                        style={{ animation: "spin 1s linear infinite", width: 16, height: 16 }}
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Membuat Sesi Pembayaran...</span>
                    </>
                  ) : (
                    <>
                      <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                      <span>Bayar dengan Midtrans Sandbox &rarr;</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Simulated Local Checkout Section */}
          <section className="card" style={{
            border: "1px solid rgba(255, 255, 255, 0.03)",
            background: "rgba(0, 0, 0, 0.15)",
            animation: "fadeIn 0.3s ease"
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <h3 style={{ color: "#ffffff", fontSize: "1rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                  Mode Pengembang: Simulasi Checkout Instan
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", lineHeight: 1.4 }}>
                  Lakukan simulasi checkout lokal offline secara instan untuk kebutuhan pengujian visualizer tanpa memerlukan transaksi gateway sungguhan.
                </p>
              </div>

              <div className="button-container" style={{ marginTop: "0.25rem" }}>
                <button
                  type="button"
                  onClick={handleBuy}
                  className="btn-download"
                  style={{ width: "100%", justifyContent: "center", border: "1px solid rgba(255, 255, 255, 0.1)" }}
                  disabled={isProcessing || isMidtransProcessing || !email.includes("@")}
                >
                  {isProcessing ? (
                    <>
                      <svg
                        style={{ animation: "spin 1s linear infinite", width: 14, height: 14, marginRight: 6 }}
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Menjalankan Simulasi...</span>
                    </>
                  ) : (
                    <span>Generate Token Simulasi (Lokal)</span>
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
            </div>
          </section>
        </div>
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
