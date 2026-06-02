"use client";

import { useState } from "react";
import { simulateTokenPurchase, createMidtransTransaction } from "../actions";
import Link from "next/link";

/**
 * BuyTokenPage component.
 * Redesigned into a beautiful SaaS check-out pricing system.
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

  // Strict email regex validation matching standard domains
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const handleBuy = async () => {
    if (!EMAIL_REGEX.test(email)) {
      alert("Silakan masukkan email dengan format yang benar (contoh: nama@domain.com).");
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
    if (!EMAIL_REGEX.test(email)) {
      alert("Silakan masukkan email dengan format yang benar (contoh: nama@domain.com).");
      return;
    }

    setIsMidtransProcessing(true);
    try {
      const res = await createMidtransTransaction(email);
      if (res.success && res.redirectUrl) {
        // Redirect the user to the Midtrans sandbox checkout
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

  const isEmailValid = EMAIL_REGEX.test(email);

  return (
    <div className="app-container" style={{ maxWidth: "800px" }}>
      <header className="header">
        <h1>Dapatkan Token Lisensi Enkripsi</h1>
        <p>
          Beli token lisensi resmi sekali pakai untuk melakukan enkripsi AES-128 secara penuh
          dan mengunduh laporan perhitungan akademik Anda secara instan.
        </p>
      </header>

      {!purchaseResult?.success ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", animation: "fadeIn 0.4s ease" }}>

          {/* Email Setup Card */}
          <section className="card" aria-labelledby="email-setup-title">
            <h2 id="email-setup-title" style={{ display: "none" }}>Email Pengiriman</h2>
            <div className="input-group" style={{ margin: 0 }}>
              <div className="label-row">
                <label className="label-text" htmlFor="email-checkout">
                  Alamat Email Penerima Token
                </label>
                <span className={`status-badge ${isEmailValid ? "valid" : "invalid"}`} aria-live="polite">
                  {isEmailValid ? "✔ Email Valid" : "Masukkan email yang valid"}
                </span>
              </div>
              <div className="input-wrapper" style={{ marginTop: "0.5rem" }}>
                <input
                  id="email-checkout"
                  type="email"
                  required
                  placeholder="nama@email.com"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isProcessing || isMidtransProcessing}
                />
              </div>
              <span className="status-badge" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
                PENTING: Pastikan email aktif. Kunci token lisensi unik akan otomatis dikirimkan langsung ke email ini.
              </span>
            </div>
          </section>

          {/* Centered Pricing Card */}
          <div style={{ display: "flex", justifyContent: "center", width: "100%", marginTop: "1rem" }}>
            {/* Midtrans Secure Gateway Option */}
            <section className="pricing-card recommended" aria-labelledby="midtrans-gateway-title" style={{ maxWidth: "500px", width: "100%" }}>
              <span className="pricing-badge">Rekomendasi</span>
              <div>
                <h3 id="midtrans-gateway-title" style={{ color: "#ffffff", fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
                  Midtrans Secure Pay
                </h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", margin: "1rem 0" }}>
                  <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--accent-cyan)" }}>Rp 82.000</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>/ 1 Token</span>
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
                  Buat sesi pembayaran aman secara real-time dengan Midtrans Gateway. Anda dapat membayar menggunakan QRIS, GoPay, ShopeePay, Transfer Bank, dll. secara instan.
                </p>
                <ul style={{ color: "var(--text-secondary)", fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "1.2rem", marginBottom: "2rem" }}>
                  <li>Konfirmasi Otomatis Real-time</li>
                  <li>Token Dikirim Otomatis ke Email</li>
                  <li>Mendukung Unduhan PDF & Word Laporan</li>
                  <li>Status Atomic Lock Database</li>
                </ul>
              </div>

              <div className="button-container" style={{ marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={handleMidtransPay}
                  className="btn-process btn-midtrans"
                  style={{ width: "100%" }}
                  disabled={isProcessing || isMidtransProcessing || !isEmailValid}
                >
                  {isMidtransProcessing ? (
                    <>
                      <svg style={{ animation: "spin 1s linear infinite", width: 16, height: 16 }} viewBox="0 0 24 24" fill="none">
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
                      <span>Bayar Aman via Midtrans</span>
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>

          {purchaseResult?.error && (
            <div style={{
              background: "var(--accent-red-glow)",
              border: "1px solid var(--accent-red)",
              color: "var(--accent-red)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4)",
              fontSize: "0.85rem",
              textAlign: "center",
              fontWeight: 600
            }} role="alert">
              ❌ {purchaseResult.error}
            </div>
          )}
        </div>
      ) : (
        <section className="card" style={{
          border: "1px solid var(--accent-emerald)",
          boxShadow: "0 0 30px rgba(16, 185, 129, 0.08)",
          animation: "fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
          maxWidth: "600px",
          margin: "0 auto"
        }} aria-labelledby="success-title">
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "var(--accent-emerald-glow)",
              border: "1px solid var(--accent-emerald)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto"
            }}>
              <svg style={{ width: 26, height: 26, color: "var(--accent-emerald)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div>
              <h2 id="success-title" style={{ color: "#ffffff", fontSize: "1.4rem", fontWeight: 800 }}>Token Berhasil Dibuat!</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                Token lisensi aman Anda telah aktif dan salinannya dikirim ke <strong style={{ color: "#ffffff" }}>{email}</strong>.
              </p>
            </div>

            <div style={{
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid var(--panel-border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
              margin: "0.5rem 0",
            }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: "0.5rem", fontWeight: 700 }}>
                KUNCI TOKEN LISENSI ANDA
              </span>
              <div style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "1.8rem",
                fontWeight: 800,
                color: "var(--accent-cyan)",
                letterSpacing: "0.08em",
                margin: "0.75rem 0",
                textShadow: "0 0 10px rgba(6, 182, 212, 0.2)"
              }}>
                {purchaseResult.token}
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Simpan token ini baik-baik. Token bersifat sekali pakai dan wajib dimasukkan pada dashboard visualisasi sebelum melakukan proses enkripsi AES.
              </p>
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "0.25rem" }}>
              <button onClick={handleCopy} className="btn-process" style={{
                padding: "var(--space-2) var(--space-4)",
                fontSize: "0.9rem",
                background: copied ? "var(--accent-emerald)" : "#ffffff",
                color: copied ? "#ffffff" : "var(--bg-color)",
                boxShadow: "none"
              }}>
                {copied ? "✓ Tersalin!" : "Salin Token"}
              </button>

              <Link href="/" className="btn-download" style={{
                padding: "var(--space-2) var(--space-4)",
                fontSize: "0.9rem",
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none"
              }}>
                Gunakan Token
              </Link>
            </div>

            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", borderTop: "1px solid var(--panel-border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
              📧 Salinan email pengiriman tersimpan di: <code style={{ color: "var(--accent-purple)", fontFamily: "JetBrains Mono" }}>scratch/sent-emails.log</code>
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
