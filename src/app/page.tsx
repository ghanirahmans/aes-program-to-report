"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { processAes, convertDocxToPdfAction, type AesActionResult } from "./actions";

// Real-time conversion helper utilities
function textToHex(text: string): string {
  let hex = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const byte = code <= 255 ? code : 0x3f; // Fallback to '?' for characters outside Latin1
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function hexToText(hex: string): string {
  const cleanHex = hex.replace(/[^0-9A-Fa-f]/g, "");
  let text = "";
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byteStr = cleanHex.slice(i, i + 2);
    if (byteStr.length === 2) {
      const byte = parseInt(byteStr, 16);
      text += String.fromCharCode(byte);
    }
  }
  return text;
}

function formatHexWithSpaces(hexStr: string): string {
  const bytes = hexStr.match(/.{1,2}/g) ?? [];
  return bytes.join(" ").toUpperCase();
}

function getAesStateMatrix(hexStr: string): string[] {
  const cleanHex = hexStr.replace(/[^0-9A-Fa-f]/g, "");
  const bytes: string[] = [];
  for (let i = 0; i < 16; i++) {
    const byte = cleanHex.slice(i * 2, i * 2 + 2);
    bytes.push(byte.length === 2 ? byte.toUpperCase() : "");
  }
  return bytes;
}

interface TerminalLine {
  text: string;
  type: "info" | "header" | "step-title" | "matrix" | "success" | "error" | "poly";
}

interface PlaybackItem extends TerminalLine {
  delay: number;
}

export default function Home() {
  const [licenseToken, setLicenseToken] = useState("");

  // Master states containing raw text and hex values
  const [plainText, setPlainText] = useState("AkuCintaKamuLhoo");
  const [plainHex, setPlainHex] = useState(textToHex("IniKuncibuatEkri"));
  const [plainMode, setPlainMode] = useState<"text" | "hex">("text");

  const [keyText, setKeyText] = useState("IniKuncibuatEkri");
  const [keyHex, setKeyHex] = useState(textToHex("IniKuncibuatEkri"));
  const [keyMode, setKeyMode] = useState<"text" | "hex">("text");

  // Status & simulation states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedMode, setSpeedMode] = useState<"1x" | "2x" | "skip">("1x");

  // Server result state
  const [actionResult, setActionResult] = useState<AesActionResult | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Playback queue & index
  const [playbackQueue, setPlaybackQueue] = useState<PlaybackItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);

  // Terminal scroll ref
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  // Render initial terminal screen line
  useEffect(() => {
    const el = terminalBodyRef.current;
    if (el && el.childNodes.length === 0) {
      const welcomeDiv = document.createElement("div");
      welcomeDiv.className = "log-line log-info";
      welcomeDiv.textContent = "user@aes-core:~$ _";
      el.appendChild(welcomeDiv);
    }
  }, []);

  // Real-time changes handler for Plaintext
  const handlePlainInputChange = (val: string) => {
    if (plainMode === "text") {
      if (val.length > 16) return; // Limit to 16 bytes
      setPlainText(val);
      setPlainHex(textToHex(val));
    } else {
      const filtered = val.replace(/[^0-9A-Fa-f]/g, "");
      if (filtered.length > 32) return; // Limit to 32 hex chars (16 bytes)
      setPlainHex(filtered);
      setPlainText(hexToText(filtered));
    }
  };

  // Real-time changes handler for Key
  const handleKeyInputChange = (val: string) => {
    if (keyMode === "text") {
      if (val.length > 16) return; // Limit to 16 bytes
      setKeyText(val);
      setKeyHex(textToHex(val));
    } else {
      const filtered = val.replace(/[^0-9A-Fa-f]/g, "");
      if (filtered.length > 32) return; // Limit to 32 hex chars (16 bytes)
      setKeyHex(filtered);
      setKeyText(hexToText(filtered));
    }
  };

  // Length calculations for validation badges
  const plainBytesCount = plainText.length;
  const keyBytesCount = keyText.length;

  const isPlaintextValid = plainBytesCount === 16;
  const isKeyValid = keyBytesCount === 16;
  const isTokenFormatValid = licenseToken.length === 16 && /^[A-Z0-9]+$/.test(licenseToken);
  const canProcess = isPlaintextValid && isKeyValid && isTokenFormatValid && !isProcessing;

  // Function to determine log type and raw delay
  const parseLogLine = (line: string): PlaybackItem => {
    const trimmed = line.trim();
    let type: TerminalLine["type"] = "info";
    let rawDelay = 30; // default base delay in ms

    if (
      trimmed.startsWith("===== MEMULAI PROSES") ||
      trimmed.startsWith("===== RINGKASAN") ||
      trimmed.startsWith("===== PROSES SELESAI")
    ) {
      type = "success";
      rawDelay = 500;
    } else if (trimmed.startsWith("===== RONDE") || trimmed.startsWith("===== PROSES KEY SCHEDULE")) {
      type = "header";
      rawDelay = 400;
    } else if (trimmed.startsWith("--- Langkah:") || trimmed.startsWith("=== Proses Membuat")) {
      type = "step-title";
      rawDelay = 250;
    } else if (trimmed.startsWith("|") || trimmed.includes("--- XOR")) {
      type = "matrix";
      rawDelay = 25;
    } else if (trimmed.includes("⊕") || trimmed.includes("*") || trimmed.includes("x^")) {
      type = "poly";
      rawDelay = 15;
    } else if (trimmed.startsWith("[SUCCESS]") || trimmed.startsWith("Ciphertext (Hex):")) {
      type = "success";
      rawDelay = 100;
    } else if (trimmed.startsWith("[ERROR]") || trimmed.startsWith("Gagal")) {
      type = "error";
      rawDelay = 200;
    }

    return { text: line, type, delay: rawDelay };
  };

  // Start the processing
  const handleProcess = async () => {
    if (!canProcess) return;

    // Reset states
    setIsProcessing(true);
    setIsPlaying(false);
    setIsFinished(false);
    setProgress(0);
    setActionResult(null);

    // Manipulate DOM directly to clear and initialize terminal
    const el = terminalBodyRef.current;
    if (el) {
      el.innerHTML = "";

      const firstLine = document.createElement("div");
      firstLine.className = "log-line log-info";
      firstLine.textContent = "user@aes-core:~$ ./aes_cryptography_engine --input=" + plainText + " --key=" + keyText + " --token=" + licenseToken;
      el.appendChild(firstLine);

      const secondLine = document.createElement("div");
      secondLine.className = "log-line log-info";
      secondLine.textContent = "[SYSTEM] Memverifikasi token lisensi di database...";
      el.appendChild(secondLine);

      el.scrollTop = el.scrollHeight;
    }

    // 1. Verify License Token by calling the API route
    try {
      const activateRes = await fetch("/api/license/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: licenseToken }),
      });

      const activateData = await activateRes.json();

      if (!activateRes.ok || !activateData.success) {
        if (el) {
          const errLine = document.createElement("div");
          errLine.className = "log-line log-error";
          errLine.textContent = `[ERROR] Gagal memverifikasi token: ${activateData.message || "Token tidak valid atau sudah digunakan!"}`;
          el.appendChild(errLine);

          const stopLine = document.createElement("div");
          stopLine.className = "log-line log-error";
          stopLine.textContent = `[SYSTEM] Proses dihentikan. Silakan beli token baru.`;
          el.appendChild(stopLine);

          el.scrollTop = el.scrollHeight;
        }
        setIsProcessing(false);
        return;
      }

      if (el) {
        const okLine = document.createElement("div");
        okLine.className = "log-line log-success";
        okLine.textContent = `[SUCCESS] Token terverifikasi! Status berubah menjadi USED di database secara atomic.`;
        el.appendChild(okLine);

        const initLine = document.createElement("div");
        initLine.className = "log-line log-info";
        initLine.textContent = `[SYSTEM] Memulai pemanggilan mesin enkripsi AES...`;
        el.appendChild(initLine);

        el.scrollTop = el.scrollHeight;
      }
    } catch (err: any) {
      if (el) {
        const netErrLine = document.createElement("div");
        netErrLine.className = "log-line log-error";
        netErrLine.textContent = `[ERROR] Kesalahan jaringan saat menghubungi server lisensi.`;
        el.appendChild(netErrLine);
        el.scrollTop = el.scrollHeight;
      }
      setIsProcessing(false);
      return;
    }

    // 2. Call Next.js Server Action
    const res = await processAes(plainText, keyText, licenseToken, plainMode, keyMode);

    if (!res.success || !res.logs) {
      if (el) {
        const failLine = document.createElement("div");
        failLine.className = "log-line log-error";
        failLine.textContent = `[ERROR] Gagal memproses enkripsi AES: ${res.error || "Unknown error"}`;
        el.appendChild(failLine);
        el.scrollTop = el.scrollHeight;
      }
      setIsProcessing(false);
      return;
    }

    setActionResult(res);

    // Build the logs queue
    const parsedQueue = res.logs.map(parseLogLine);

    // Calculate total base delay sum to scale to exactly 60 seconds (60,000 ms)
    const baseSum = parsedQueue.reduce((acc, item) => acc + item.delay, 0);
    const targetDuration = 60000; // 60 seconds
    const scaleFactor = targetDuration / baseSum;

    // Apply the scaling factor so total duration is exactly 60s
    const scaledQueue = parsedQueue.map((item) => ({
      ...item,
      delay: Math.max(1, Math.round(item.delay * scaleFactor)),
    }));

    setPlaybackQueue(scaledQueue);
    setCurrentQueueIndex(0);
    setIsPlaying(true);
  };

  // Playback execution hook using Direct DOM Manipulation to prevent React re-render overhead
  useEffect(() => {
    if (!isPlaying || playbackQueue.length === 0) return;

    let timerId: NodeJS.Timeout;
    let currentIndex = currentQueueIndex;
    const el = terminalBodyRef.current;

    const printNextLine = () => {
      if (currentIndex >= playbackQueue.length) {
        setIsPlaying(false);
        setIsProcessing(false);
        setIsFinished(true);
        setProgress(100);

        if (el) {
          const existingCursor = el.querySelector(".cursor-blink");
          if (existingCursor) existingCursor.remove();

          const finalPrompt = document.createElement("div");
          finalPrompt.className = "log-line log-info";
          finalPrompt.textContent = "user@aes-core:~$ _";
          el.appendChild(finalPrompt);
          el.scrollTop = el.scrollHeight;
        }
        return;
      }

      if (speedMode === "skip") {
        const remaining = playbackQueue.slice(currentIndex);
        if (el) {
          const existingCursor = el.querySelector(".cursor-blink");
          if (existingCursor) existingCursor.remove();

          remaining.forEach((line) => {
            const lineDiv = document.createElement("div");
            let className = "log-line";
            if (line.type === "header") className += " log-header";
            else if (line.type === "step-title") className += " log-step-title";
            else if (line.type === "matrix") className += " log-matrix";
            else if (line.type === "success") className += " log-success";
            else if (line.type === "error") className += " log-error";
            else if (line.type === "poly") className += " log-poly";
            lineDiv.className = className;
            lineDiv.textContent = line.text;
            el.appendChild(lineDiv);
          });

          const finalPrompt = document.createElement("div");
          finalPrompt.className = "log-line log-info";
          finalPrompt.textContent = "user@aes-core:~$ _";
          el.appendChild(finalPrompt);
          el.scrollTop = el.scrollHeight;
        }

        setCurrentQueueIndex(playbackQueue.length);
        setIsPlaying(false);
        setIsProcessing(false);
        setIsFinished(true);
        setProgress(100);
        return;
      }

      const item = playbackQueue[currentIndex];

      if (el) {
        const existingCursor = el.querySelector(".cursor-blink");
        if (existingCursor) existingCursor.remove();

        const lineDiv = document.createElement("div");
        let className = "log-line";
        if (item.type === "header") className += " log-header";
        else if (item.type === "step-title") className += " log-step-title";
        else if (item.type === "matrix") className += " log-matrix";
        else if (item.type === "success") className += " log-success";
        else if (item.type === "error") className += " log-error";
        else if (item.type === "poly") className += " log-poly";
        lineDiv.className = className;
        lineDiv.textContent = item.text;

        const cursorSpan = document.createElement("span");
        cursorSpan.className = "cursor-blink";
        lineDiv.appendChild(cursorSpan);

        el.appendChild(lineDiv);
        el.scrollTop = el.scrollHeight;
      }

      const pct = Math.min(100, Math.round(((currentIndex + 1) / playbackQueue.length) * 100));
      setProgress(pct);

      currentIndex += 1;
      setCurrentQueueIndex(currentIndex);

      const delay = item.delay / (speedMode === "2x" ? 2 : 1);
      timerId = setTimeout(printNextLine, delay);
    };

    timerId = setTimeout(printNextLine, 0);

    return () => clearTimeout(timerId);
  }, [isPlaying, playbackQueue, currentQueueIndex, speedMode]);

  // Client-side download handlers
  const handleDownload = async (type: "pdf" | "docx" | "zip") => {
    if (!actionResult) return;

    let base64 =
      type === "docx" ? actionResult.docxBase64 :
        type === "pdf" ? actionResult.pdfBase64 :
          actionResult.zipBase64;

    if (type === "pdf" && !base64) {
      if (!actionResult.docxBase64) {
        alert("Berkas Word (DOCX) tidak tersedia untuk membuat PDF.");
        return;
      }

      setIsGeneratingPdf(true);
      try {
        const res = await convertDocxToPdfAction(actionResult.docxBase64);
        if (res.success && res.pdfBase64) {
          base64 = res.pdfBase64;
          setActionResult((prev) => (prev ? { ...prev, pdfBase64: res.pdfBase64 } : null));
        } else {
          alert(`Gagal mengonversi ke PDF: ${res.error || "Unknown error"}`);
          return;
        }
      } catch (err) {
        alert("Terjadi kesalahan jaringan saat mencoba mengonversi PDF.");
        return;
      } finally {
        setIsGeneratingPdf(false);
      }
    }

    if (!base64) {
      alert(`Berkas ${type.toUpperCase()} tidak tersedia.`);
      return;
    }

    const mimeMap = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pdf: "application/pdf",
      zip: "application/zip",
    };

    const filename = `Laporan_AES_${plainText.replace(/[^A-Za-z0-9]/g, "_")}.${type}`;

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
  };

  // Derive State Matrices for real-time visualization
  const plaintextBytes = getAesStateMatrix(plainHex);
  const keyBytes = getAesStateMatrix(keyHex);

  return (
    <div className="app-container">
      {/* Header Section */}
      <header className="header">
        <h1>AES-128 Encryption Dashboard</h1>
        <p>
          Simulasikan enkripsi AES-128 secara interaktif, pelajari setiap langkah perhitungan matematisnya
          melalui terminal pengembang, dan unduh laporan komplit (.docx & .pdf) untuk tugas Anda.
        </p>
      </header>

      {/* Main Redesigned Form Card */}
      <section className="card" aria-labelledby="form-card-title">
        <h2 id="form-card-title" style={{ display: "none" }}>Konfigurasi Masukan AES</h2>
        <div className="form-grid">
          {/* Plaintext Input Group */}
          <div className="input-group">
            <div className="label-row">
              <span className="label-text">Plaintext State Block</span>
              <div className="toggle-tab-container" role="tablist" aria-label="Format Plaintext">
                <button
                  role="tab"
                  aria-selected={plainMode === "text"}
                  className={`toggle-tab ${plainMode === "text" ? "active" : ""}`}
                  onClick={() => setPlainMode("text")}
                  disabled={isProcessing}
                >
                  Teks ASCII
                </button>
                <button
                  role="tab"
                  aria-selected={plainMode === "hex"}
                  className={`toggle-tab ${plainMode === "hex" ? "active" : ""}`}
                  onClick={() => setPlainMode("hex")}
                  disabled={isProcessing}
                >
                  Heksadesimal
                </button>
              </div>
            </div>

            <div className="input-wrapper">
              <input
                type="text"
                className="input-field"
                placeholder={
                  plainMode === "text"
                    ? "Maksimal 16 karakter..."
                    : "32 digit heksadesimal..."
                }
                value={plainMode === "text" ? plainText : plainHex}
                onChange={(e) => handlePlainInputChange(e.target.value)}
                disabled={isProcessing}
                aria-label="Plaintext Input"
              />
            </div>

            <div className="preview-row" aria-live="polite">
              <span className="preview-label">
                {plainMode === "text" ? "HEXOUT:" : "ASCII:"}
              </span>
              <span>
                {plainMode === "text"
                  ? formatHexWithSpaces(plainHex) || "-"
                  : plainText || "(Format heksadesimal kosong)"}
              </span>
            </div>

            {/* Real-time 4x4 State Grid Visualizer */}
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                Visualisasi Matriks State AES (Column-Major Order):
              </span>
              <div className="matrix-visualizer">
                {Array.from({ length: 16 }).map((_, idx) => {
                  const row = Math.floor(idx / 4);
                  const col = idx % 4;
                  const cellIdx = col * 4 + row;
                  const byteVal = plaintextBytes[cellIdx];
                  return (
                    <div key={idx} className={`matrix-cell ${byteVal ? "filled" : ""}`}>
                      {byteVal || "--"}
                      <span className="matrix-cell-index">s[{row},{col}]</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="label-row" style={{ marginTop: "2px" }}>
              <span className="status-badge" style={{ fontSize: "0.75rem" }}>
                Auto-convert ke 16-byte block.
              </span>
              <span className={`status-badge ${isPlaintextValid ? "valid" : "invalid"}`} aria-live="polite">
                {isPlaintextValid ? "✔ Valid (16 Byte)" : `${plainBytesCount} / 16 Byte`}
              </span>
            </div>
          </div>

          {/* Key Input Group */}
          <div className="input-group">
            <div className="label-row">
              <span className="label-text">Cipher Key (128-bit)</span>
              <div className="toggle-tab-container" role="tablist" aria-label="Format Cipher Key">
                <button
                  role="tab"
                  aria-selected={keyMode === "text"}
                  className={`toggle-tab ${keyMode === "text" ? "active" : ""}`}
                  onClick={() => setKeyMode("text")}
                  disabled={isProcessing}
                >
                  Teks ASCII
                </button>
                <button
                  role="tab"
                  aria-selected={keyMode === "hex"}
                  className={`toggle-tab ${keyMode === "hex" ? "active" : ""}`}
                  onClick={() => setKeyMode("hex")}
                  disabled={isProcessing}
                >
                  Heksadesimal
                </button>
              </div>
            </div>

            <div className="input-wrapper">
              <input
                type="text"
                className="input-field"
                placeholder={
                  keyMode === "text"
                    ? "Maksimal 16 karakter..."
                    : "32 digit heksadesimal..."
                }
                value={keyMode === "text" ? keyText : keyHex}
                onChange={(e) => handleKeyInputChange(e.target.value)}
                disabled={isProcessing}
                aria-label="Cipher Key Input"
              />
            </div>

            <div className="preview-row" aria-live="polite">
              <span className="preview-label">
                {keyMode === "text" ? "HEXOUT:" : "ASCII:"}
              </span>
              <span>
                {keyMode === "text"
                  ? formatHexWithSpaces(keyHex) || "-"
                  : keyText || "(Format heksadesimal kosong)"}
              </span>
            </div>

            {/* Real-time 4x4 State Grid Visualizer */}
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                Visualisasi Matriks State Kunci (Column-Major Order):
              </span>
              <div className="matrix-visualizer">
                {Array.from({ length: 16 }).map((_, idx) => {
                  const row = Math.floor(idx / 4);
                  const col = idx % 4;
                  const cellIdx = col * 4 + row;
                  const byteVal = keyBytes[cellIdx];
                  return (
                    <div key={idx} className={`matrix-cell ${byteVal ? "active-key" : ""}`}>
                      {byteVal || "--"}
                      <span className="matrix-cell-index">w[{row},{col}]</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="label-row" style={{ marginTop: "2px" }}>
              <span className="status-badge" style={{ fontSize: "0.75rem" }}>
                Cipher key standard 128-bit.
              </span>
              <span className={`status-badge ${isKeyValid ? "valid" : "invalid"}`} aria-live="polite">
                {isKeyValid ? "✔ Valid (16 Byte)" : `${keyBytesCount} / 16 Byte`}
              </span>
            </div>
          </div>

          {/* License Token Input Group */}
          <div className="input-group" style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--panel-border)", paddingTop: "1.5rem" }}>
            <div className="label-row">
              <span className="label-text" style={{ color: "var(--accent-cyan)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Token Lisensi Keamanan (Sekali Pakai)
              </span>
              <span className="status-badge">
                <Link href="/buy-token" style={{ color: "var(--accent-purple)", textDecoration: "none", fontWeight: 700 }}>
                  Belum punya token? Beli di sini &rarr;
                </Link>
              </span>
            </div>
            <div className="input-wrapper">
              <input
                type="text"
                className="input-field"
                placeholder="Masukkan 16 karakter token (Contoh: X9K2M7PQ4L8RD3WT)..."
                style={{ borderColor: licenseToken && !isTokenFormatValid ? "var(--accent-amber)" : isTokenFormatValid ? "var(--accent-emerald)" : "" }}
                value={licenseToken}
                onChange={(e) => setLicenseToken(e.target.value.toUpperCase().trim())}
                disabled={isProcessing}
                aria-label="Crypto License Token"
              />
            </div>
            <div className="label-row" style={{ marginTop: "-0.2rem" }}>
              <span className="status-badge" style={{ fontSize: "0.75rem" }}>
                Token ditandai sebagai USED di database secara atomic pasca ekripsi.
              </span>
              <span className={`status-badge ${isTokenFormatValid ? "valid" : "invalid"}`} aria-live="polite">
                {isTokenFormatValid ? "✔ Format Valid" : `${licenseToken.length} / 16 Karakter`}
              </span>
            </div>
          </div>
        </div>

        {/* Process Button */}
        <div className="button-container">
          <button
            className="btn-process"
            disabled={!canProcess}
            onClick={handleProcess}
          >
            {isProcessing ? (
              <>
                <svg
                  style={{ animation: "spin 1s linear infinite", width: 18, height: 18 }}
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    style={{ opacity: 0.25 }}
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Memproses Mesin AES...</span>
              </>
            ) : (
              <>
                <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span>Proses Enkripsi</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Terminal Simulator Card */}
      <section className={`terminal-window ${isPlaying ? "active" : ""}`} aria-labelledby="terminal-title-text">
        {/* Terminal Header */}
        <div className="terminal-header">
          <div className="terminal-buttons">
            <span className="terminal-btn close" />
            <span className="terminal-btn minimize" />
            <span className="terminal-btn maximize" />
          </div>
          <div id="terminal-title-text" className="terminal-title">aes-simulation-terminal</div>
          <div className="terminal-controls">
            <button
              className={`speed-badge ${speedMode === "1x" ? "active" : ""}`}
              onClick={() => setSpeedMode("1x")}
              aria-label="Kecepatan 1x"
            >
              1X SPEED
            </button>
            <button
              className={`speed-badge ${speedMode === "2x" ? "active" : ""}`}
              onClick={() => setSpeedMode("2x")}
              aria-label="Kecepatan 2x"
            >
              2X SPEED
            </button>
            <button
              className={`speed-badge ${speedMode === "skip" ? "active" : ""}`}
              onClick={() => setSpeedMode("skip")}
              aria-label="Lewati Animasi"
            >
              SKIP
            </button>
          </div>
        </div>

        {/* Terminal Text Screen (Uncontrolled DOM container) */}
        <div className="terminal-body" ref={terminalBodyRef} aria-live="assertive" />

        {/* Terminal Thin Status Bar */}
        <div className="terminal-status-bar">
          <div className="progress-container">
            <span>PROGRESS:</span>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <span>{progress}%</span>
          </div>
          <div>
            <span style={{ fontWeight: 700 }}>
              {isFinished
                ? "SIMULATION COMPLETED"
                : isPlaying
                  ? `RUNNING (${speedMode === "1x" ? "60s" : speedMode === "2x" ? "30s" : "INSTANT"})`
                  : "ENGINE STANDBY"}
            </span>
          </div>
        </div>
      </section>

      {/* Clean PDF & Word Report Downloads Box */}
      {isFinished && actionResult?.success && (
        <section className="card download-section" aria-labelledby="download-card-title">
          <div id="download-card-title" className="download-title">
            <svg
              style={{ width: 24, height: 24, color: "var(--accent-emerald)" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Enkripsi Sukses! Laporan Akademik Siap Diunduh</span>
          </div>

          <div style={{ textAlign: "center", maxWidth: "600px" }}>
            <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
              Ciphertext Hasil (Heksadesimal):{" "}
              <code style={{ color: "var(--accent-cyan)", background: "rgba(6, 182, 212, 0.08)", padding: "0.25rem 0.65rem", borderRadius: "6px", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: "0.95rem", border: "1px solid var(--accent-cyan-border)" }}>
                {actionResult.cipherHex?.toUpperCase()}
              </code>
            </p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              Kami telah merangkum semua visualisasi langkah perhitungan matriks, SubBytes, ShiftRows, MixColumns, dan
              Key Expansion ke dalam dokumen resmi untuk kebutuhan tugas Keamanan Informasi Anda:
            </p>
          </div>

          <div className="download-buttons">
            <button className="btn-download docx" onClick={() => handleDownload("docx")}>
              <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Laporan Word (.docx)</span>
            </button>
            <button className="btn-download pdf" onClick={() => handleDownload("pdf")} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? (
                <>
                  <svg
                    style={{ animation: "spin 1s linear infinite", width: 18, height: 18, marginRight: 6 }}
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      style={{ opacity: 0.25 }}
                    />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Mengekspor PDF...</span>
                </>
              ) : (
                <>
                  <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>Laporan PDF (.pdf)</span>
                </>
              )}
            </button>
            <button className="btn-download zip" onClick={() => handleDownload("zip")}>
              <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <path d="M12 11v6" />
                <path d="m9 14 3 3 3-3" />
              </svg>
              <span>Arsip Lengkap (.zip)</span>
            </button>
          </div>
        </section>
      )}

      {/* Minimal Footer */}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} AES Visual - Tugas Kuliah - GhaniRahmans</p>
      </footer>
    </div>
  );
}
