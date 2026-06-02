"use client";

import { useState } from "react";
import Link from "next/link";
import { getEncryptionHistory, processAes, convertDocxToPdfAction, type HistoryRecord } from "../actions";

export default function HistoryPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[] | null>(null);
  const [error, setError] = useState("");
  const [copiedRecordId, setCopiedRecordId] = useState<string | null>(null);

  // Generating states for dynamic re-downloads
  const [generatingStates, setGeneratingStates] = useState<{ [key: string]: boolean }>({});

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !token) {
      setError("Silakan lengkapi Email dan Token.");
      return;
    }

    setIsSearching(true);
    setError("");
    setRecords(null);

    try {
      const res = await getEncryptionHistory(email, token);
      if (res.success && res.history) {
        setRecords(res.history);
      } else {
        setError(res.error || "Gagal memverifikasi kredensial.");
      }
    } catch (err) {
      setError("Terjadi gangguan jaringan saat mengambil data.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async (record: HistoryRecord, type: "pdf" | "docx" | "zip") => {
    const actionKey = `${record.id}-${type}`;
    setGeneratingStates((prev) => ({ ...prev, [actionKey]: true }));

    try {
      // Regenerate the AES report dynamically in memory by calling our core server action!
      // Do NOT pass the licenseToken parameter to prevent generating a new database log entry.
      const res = await processAes(record.plaintext, record.key, undefined, record.plainMode, record.keyMode);

      if (!res.success) {
        alert(`Gagal meregenerasi berkas: ${res.error || "Unknown error"}`);
        return;
      }

      let base64 =
        type === "docx" ? res.docxBase64 :
          type === "pdf" ? res.pdfBase64 :
            res.zipBase64;

      if (type === "pdf" && !base64) {
        if (!res.docxBase64) {
          alert("Berkas Word tidak tersedia untuk memproses konversi PDF.");
          return;
        }

        // On-demand PDF conversion fallback
        const pdfRes = await convertDocxToPdfAction(res.docxBase64);
        if (pdfRes.success && pdfRes.pdfBase64) {
          base64 = pdfRes.pdfBase64;
        } else {
          alert(`Gagal mengonversi ke PDF: ${pdfRes.error || "Unknown error"}`);
          return;
        }
      }

      if (!base64) {
        alert("Berkas tidak tersedia.");
        return;
      }

      const mimeMap = {
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        pdf: "application/pdf",
        zip: "application/zip",
      };

      const filename = `Laporan_AES_${record.plaintext.replace(/[^A-Za-z0-9]/g, "_")}.${type}`;

      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mimeMap[type] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      alert("Terjadi kesalahan sistem saat mengunduh laporan.");
    } finally {
      setGeneratingStates((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleCopyCipher = (record: HistoryRecord) => {
    navigator.clipboard.writeText(record.cipherHex);
    setCopiedRecordId(record.id);
    setTimeout(() => setCopiedRecordId(null), 2000);
  };

  const formatHexWithSpaces = (hexStr: string): string => {
    const bytes = hexStr.match(/.{1,2}/g) ?? [];
    return bytes.join(" ").toUpperCase();
  };

  return (
    <div className="app-container" style={{ maxWidth: "800px" }}>
      <header className="header">
        <h1>Riwayat Laporan & Enkripsi</h1>
        <p>
          Kehilangan file Anda? Masukkan email dan kunci token lisensi yang telah Anda gunakan sebelumnya
          untuk memulihkan riwayat enkripsi dan mengunduh ulang berkas laporan Anda tanpa biaya tambahan.
        </p>
      </header>

      {/* Lookup Card Form */}
      <section className="card" aria-labelledby="history-lookup-title">
        <h2 id="history-lookup-title" style={{ display: "none" }}>Formulir Pencarian Riwayat</h2>
        <form onSubmit={handleSearch} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr", gap: "1.25rem" }}>
            <div className="input-group">
              <label className="label-text" htmlFor="history-email">Alamat Email Pembelian</label>
              <div className="input-wrapper">
                <input
                  id="history-email"
                  type="email"
                  required
                  placeholder="nama@email.com"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSearching}
                />
              </div>
            </div>
            <div className="input-group">
              <label className="label-text" htmlFor="history-token">Kunci Token Lisensi (16 Karakter)</label>
              <div className="input-wrapper">
                <input
                  id="history-token"
                  type="text"
                  required
                  placeholder="Contoh: X9K2M7PQ4L8RD3WT"
                  className="input-field"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase().trim())}
                  disabled={isSearching}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
            <Link href="/" style={{ color: "var(--text-muted)", fontSize: "0.85rem", textDecoration: "none", fontWeight: 600 }}>
              &larr; Kembali ke Dashboard
            </Link>
            <button
              type="submit"
              className="btn-process btn-midtrans"
              style={{ margin: 0, padding: "var(--space-2) var(--space-5)" }}
              disabled={isSearching || !email || !token}
            >
              {isSearching ? (
                <>
                  <svg style={{ animation: "spin 1s linear infinite", width: 15, height: 15 }} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Mencari Riwayat...</span>
                </>
              ) : (
                <span>Cari Riwayat</span>
              )}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div style={{
          background: "var(--accent-red-glow)",
          border: "1px solid var(--accent-red)",
          color: "var(--accent-red)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3) var(--space-4)",
          fontSize: "0.88rem",
          textAlign: "center",
          fontWeight: 600,
          animation: "fadeIn 0.3s ease"
        }} role="alert">
          ❌ {error}
        </div>
      )}

      {/* Query Results */}
      {records && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", animation: "fadeIn 0.4s ease" }}>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--accent-cyan)", borderBottom: "1px dashed var(--panel-border)", paddingBottom: "0.5rem" }}>
            Daftar Arsip Enkripsi Terverifikasi ({records.length})
          </h3>

          {records.length === 0 ? (
            <section className="card" style={{ textAlign: "center", padding: "3rem var(--space-4)" }}>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                Token ini valid, tetapi Anda belum pernah melakukan proses enkripsi.
                Silakan lakukan enkripsi di Dashboard terlebih dahulu menggunakan token ini.
              </p>
            </section>
          ) : (
            records.map((record) => (
              <section key={record.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }} aria-labelledby={`record-title-${record.id}`}>
                {/* Record Header Metadata */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)", borderBottom: "1px solid var(--panel-border)", paddingBottom: "0.75rem" }}>
                  <span id={`record-title-${record.id}`} style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 700 }}>
                    ID: {record.id.toUpperCase()} • {new Date(record.createdAt).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
                  </span>
                  <span style={{ fontSize: "0.75rem", background: "var(--accent-emerald-glow)", color: "var(--accent-emerald)", border: "1px solid var(--accent-emerald-border)", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontWeight: 700 }}>
                    Token Terpakai
                  </span>
                </div>

                {/* Plaintext, Key and Ciphertext details */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.85rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem" }}>
                    <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>Plaintext:</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#ffffff" }}>
                      "{record.plaintext}"
                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "6px" }}>
                        ({record.plainMode === "text" ? "ASCII" : "HEX"}: {formatHexWithSpaces(record.plaintext)})
                      </span>
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem" }}>
                    <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>Cipher Key:</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#ffffff" }}>
                      "{record.key}"
                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "6px" }}>
                        ({record.keyMode === "text" ? "ASCII" : "HEX"}: {formatHexWithSpaces(record.key)})
                      </span>
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>Ciphertext:</span>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <code style={{ color: "var(--accent-cyan)", background: "rgba(6, 182, 212, 0.08)", padding: "2px 8px", borderRadius: "4px", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, border: "1px solid var(--accent-cyan-border)" }}>
                        {record.cipherHex.toUpperCase()}
                      </code>
                      <button
                        onClick={() => handleCopyCipher(record)}
                        style={{ background: "transparent", border: "none", color: copiedRecordId === record.id ? "var(--accent-emerald)" : "var(--accent-purple)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}
                      >
                        {copiedRecordId === record.id ? "✓ Tersalin!" : "Salin Cipher"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Regenerations */}
                <div style={{ borderTop: "1px dashed var(--panel-border)", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Regenerasi laporan dinamis di memori server (tanpa memotong kuota token baru).
                  </span>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      className="btn-download docx"
                      style={{ padding: "6px 12px", fontSize: "0.78rem", borderRadius: "var(--radius-sm)" }}
                      onClick={() => handleDownload(record, "docx")}
                      disabled={generatingStates[`${record.id}-docx`]}
                    >
                      {generatingStates[`${record.id}-docx`] ? "Mengekspor..." : "Word (.docx)"}
                    </button>

                    <button
                      className="btn-download pdf"
                      style={{ padding: "6px 12px", fontSize: "0.78rem", borderRadius: "var(--radius-sm)" }}
                      onClick={() => handleDownload(record, "pdf")}
                      disabled={generatingStates[`${record.id}-pdf`]}
                    >
                      {generatingStates[`${record.id}-pdf`] ? "Mengonversi..." : "PDF (.pdf)"}
                    </button>

                    <button
                      className="btn-download zip"
                      style={{ padding: "6px 12px", fontSize: "0.78rem", borderRadius: "var(--radius-sm)" }}
                      onClick={() => handleDownload(record, "zip")}
                      disabled={generatingStates[`${record.id}-zip`]}
                    >
                      {generatingStates[`${record.id}-zip`] ? "Mengompres..." : "ZIP (.zip)"}
                    </button>
                  </div>
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
