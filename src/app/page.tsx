"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { processAes, type AesActionResult } from "./actions";

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
  const [plainText, setPlainText] = useState("KeamananInformas");
  const [plainHex, setPlainHex] = useState(textToHex("KeamananInformas"));
  const [plainMode, setPlainMode] = useState<"text" | "hex">("text");

  const [keyText, setKeyText] = useState("KunciRahasiaAES1");
  const [keyHex, setKeyHex] = useState(textToHex("KunciRahasiaAES1"));
  const [keyMode, setKeyMode] = useState<"text" | "hex">("text");

  // Status & simulation states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedMode, setSpeedMode] = useState<"1x" | "2x" | "skip">("1x");

  // Terminal lines state
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { text: "guest@aes-security:~$ _", type: "info" },
  ]);

  // Server result state
  const [actionResult, setActionResult] = useState<AesActionResult | null>(null);

  // Playback queue & index
  const [playbackQueue, setPlaybackQueue] = useState<PlaybackItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);

  // Terminal scroll ref
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  // Autoscroll terminal
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [terminalLines]);

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
    setTerminalLines([
      { text: "guest@aes-security:~$ ./aes_encrypt_engine --input=" + plainText + " --key=" + keyText + " --token=" + licenseToken, type: "info" },
      { text: "[SYSTEM] Memverifikasi token lisensi di database...", type: "info" },
    ]);

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
        setTerminalLines((prev) => [
          ...prev,
          { text: `[ERROR] Gagal memverifikasi token: ${activateData.message || "Token tidak valid atau sudah digunakan!"}`, type: "error" },
          { text: `[SYSTEM] Proses dihentikan. Silakan beli token baru.`, type: "error" },
        ]);
        setIsProcessing(false);
        return;
      }

      setTerminalLines((prev) => [
        ...prev,
        { text: `[SUCCESS] Token terverifikasi! Status berubah menjadi USED di database secara atomic.`, type: "success" },
        { text: `[SYSTEM] Memulai pemanggilan mesin enkripsi AES...`, type: "info" },
      ]);
    } catch (err: any) {
      setTerminalLines((prev) => [
        ...prev,
        { text: `[ERROR] Kesalahan jaringan saat menghubungi server lisensi.`, type: "error" },
      ]);
      setIsProcessing(false);
      return;
    }

    // 2. Call Next.js Server Action
    const res = await processAes(plainText, keyText);

    if (!res.success || !res.logs) {
      setTerminalLines((prev) => [
        ...prev,
        { text: `[ERROR] Gagal memproses enkripsi AES: ${res.error || "Unknown error"}`, type: "error" },
      ]);
      setIsProcessing(false);
      return;
    }

    setActionResult(res);

    // Build the logs queue
    const parsedQueue = res.logs.map(parseLogLine);

    // Calculate total base delay sum to scale to exactly 10 seconds (10,000 ms)
    const baseSum = parsedQueue.reduce((acc, item) => acc + item.delay, 0);
    const targetDuration = 10000; // 10 seconds
    const scaleFactor = targetDuration / baseSum;

    // Apply the scaling factor so total duration is exactly 10s
    const scaledQueue = parsedQueue.map((item) => ({
      ...item,
      delay: Math.max(1, Math.round(item.delay * scaleFactor)),
    }));

    setPlaybackQueue(scaledQueue);
    setCurrentQueueIndex(0);
    setIsPlaying(true);
  };

  // Playback execution hook
  useEffect(() => {
    if (!isPlaying || playbackQueue.length === 0) return;

    let timerId: NodeJS.Timeout;
    let currentIndex = currentQueueIndex;

    const printNextLine = () => {
      if (currentIndex >= playbackQueue.length) {
        setIsPlaying(false);
        setIsProcessing(false);
        setIsFinished(true);
        setProgress(100);
        setTerminalLines((prev) => [
          ...prev,
          { text: "guest@aes-security:~$ _", type: "info" },
        ]);
        return;
      }

      if (speedMode === "skip") {
        // If skipped, dump all remaining logs instantly
        const remaining = playbackQueue.slice(currentIndex);
        setTerminalLines((prev) => [...prev, ...remaining]);
        setCurrentQueueIndex(playbackQueue.length);
        setIsPlaying(false);
        setIsProcessing(false);
        setIsFinished(true);
        setProgress(100);
        setTerminalLines((prev) => [
          ...prev,
          { text: "guest@aes-security:~$ _", type: "info" },
        ]);
        return;
      }

      const item = playbackQueue[currentIndex];
      setTerminalLines((prev) => [...prev, item]);

      // Calculate progress percentage
      const pct = Math.min(100, Math.round(((currentIndex + 1) / playbackQueue.length) * 100));
      setProgress(pct);

      currentIndex += 1;
      setCurrentQueueIndex(currentIndex);

      // Speed modifier
      const delay = item.delay / (speedMode === "2x" ? 2 : 1);
      timerId = setTimeout(printNextLine, delay);
    };

    timerId = setTimeout(printNextLine, 0);

    return () => clearTimeout(timerId);
  }, [isPlaying, playbackQueue, currentQueueIndex, speedMode]);

  // Client-side download handlers
  const handleDownload = (type: "pdf" | "docx") => {
    if (!actionResult) return;
    const base64 = type === "docx" ? actionResult.docxBase64 : actionResult.pdfBase64;
    if (!base64) {
      alert(`Berkas ${type.toUpperCase()} tidak tersedia.`);
      return;
    }

    const mimeMap = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pdf: "application/pdf",
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

  return (
    <div className="app-container">
      {/* Header Section */}
      <header className="header">
        <h1>AES Encryption Dashboard</h1>
        <p>
          Simulasikan enkripsi AES-128 secara interaktif, tinjau setiap langkah
          matematika pada terminal, dan unduh berkas laporan dalam format PDF atau Word.
        </p>
      </header>

      {/* Simplified Input Form Card */}
      <section className="card">
        <div className="form-grid">
          {/* Plaintext Input Group */}
          <div className="input-group">
            <div className="label-row">
              <span className="label-text">Plaintext Block</span>
              <div className="toggle-tab-container">
                <button
                  className={`toggle-tab ${plainMode === "text" ? "active" : ""}`}
                  onClick={() => setPlainMode("text")}
                  disabled={isProcessing}
                >
                  Teks ASCII
                </button>
                <button
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
                    ? "Masukkan maksimal 16 karakter teks..."
                    : "Masukkan 32 digit heksadesimal..."
                }
                value={plainMode === "text" ? plainText : plainHex}
                onChange={(e) => handlePlainInputChange(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            <div className="preview-row">
              <span className="preview-label">
                {plainMode === "text" ? "FORMAT HEX:" : "FORMAT TEKS:"}
              </span>
              <span>
                {plainMode === "text"
                  ? formatHexWithSpaces(plainHex) || "-"
                  : plainText || "(Teks tidak valid/kosong)"}
              </span>
            </div>

            <div className="label-row" style={{ marginTop: "-0.2rem" }}>
              <span className="status-badge" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Konversi otomatis dalam 16-byte block.
              </span>
              <span className={`status-badge ${isPlaintextValid ? "valid" : "invalid"}`}>
                {isPlaintextValid ? "✔ 16 Byte" : `${plainBytesCount} / 16 Byte`}
              </span>
            </div>
          </div>

          {/* Key Input Group */}
          <div className="input-group">
            <div className="label-row">
              <span className="label-text">Cipher Key (128-bit)</span>
              <div className="toggle-tab-container">
                <button
                  className={`toggle-tab ${keyMode === "text" ? "active" : ""}`}
                  onClick={() => setKeyMode("text")}
                  disabled={isProcessing}
                >
                  Teks ASCII
                </button>
                <button
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
                    ? "Masukkan maksimal 16 karakter kunci..."
                    : "Masukkan 32 digit heksadesimal..."
                }
                value={keyMode === "text" ? keyText : keyHex}
                onChange={(e) => handleKeyInputChange(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            <div className="preview-row">
              <span className="preview-label">
                {keyMode === "text" ? "FORMAT HEX:" : "FORMAT TEKS:"}
              </span>
              <span>
                {keyMode === "text"
                  ? formatHexWithSpaces(keyHex) || "-"
                  : keyText || "(Teks tidak valid/kosong)"}
              </span>
            </div>

            <div className="label-row" style={{ marginTop: "-0.2rem" }}>
              <span className="status-badge" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Kunci kriptografi 16 byte.
              </span>
              <span className={`status-badge ${isKeyValid ? "valid" : "invalid"}`}>
                {isKeyValid ? "✔ 16 Byte" : `${keyBytesCount} / 16 Byte`}
              </span>
            </div>
          </div>

          {/* License Token Input Group */}
          <div className="input-group" style={{ gridColumn: "1 / -1", borderTop: "1px dashed rgba(255, 255, 255, 0.05)", paddingTop: "1.25rem" }}>
            <div className="label-row">
              <span className="label-text" style={{ color: "var(--accent-cyan)" }}>Token Lisensi Kriptografi (Sekali Pakai)</span>
              <span className="status-badge">
                <Link href="/buy-token" style={{ color: "var(--accent-purple)", textDecoration: "none", fontWeight: 600 }}>
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
              />
            </div>
            <div className="label-row" style={{ marginTop: "-0.2rem" }}>
              <span className="status-badge" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Satu token hanya dapat digunakan untuk memproses satu kali enkripsi.
              </span>
              <span className={`status-badge ${isTokenFormatValid ? "valid" : "invalid"}`}>
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
                  style={{ animation: "spin 1s linear infinite", width: 16, height: 16 }}
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
                <span>Memproses AES...</span>
              </>
            ) : (
              <span>Proses Enkripsi</span>
            )}
          </button>
        </div>
      </section>

      {/* Terminal Simulator Card */}
      <section className="terminal-window">
        {/* Terminal Header */}
        <div className="terminal-header">
          <div className="terminal-buttons">
            <span className="terminal-btn"></span>
            <span className="terminal-btn"></span>
            <span className="terminal-btn"></span>
          </div>
          <div className="terminal-title">aes-simulation-terminal</div>
          <div className="terminal-controls">
            <button
              className={`speed-badge ${speedMode === "1x" ? "active" : ""}`}
              onClick={() => setSpeedMode("1x")}
            >
              1X SPEED
            </button>
            <button
              className={`speed-badge ${speedMode === "2x" ? "active" : ""}`}
              onClick={() => setSpeedMode("2x")}
            >
              2X SPEED
            </button>
            <button
              className={`speed-badge ${speedMode === "skip" ? "active" : ""}`}
              onClick={() => setSpeedMode("skip")}
            >
              SKIP
            </button>
          </div>
        </div>

        {/* Terminal Text Screen */}
        <div className="terminal-body" ref={terminalBodyRef}>
          {terminalLines.map((line, idx) => {
            let className = "log-line";
            if (line.type === "header") className += " log-header";
            else if (line.type === "step-title") className += " log-step-title";
            else if (line.type === "matrix") className += " log-matrix";
            else if (line.type === "success") className += " log-success";
            else if (line.type === "error") className += " log-error";
            else if (line.type === "poly") className += " log-poly";
            else if (idx === 0) className += " log-welcome";

            return (
              <div key={idx} className={className}>
                {line.text}
                {idx === terminalLines.length - 1 && isPlaying && <span className="cursor-blink" />}
              </div>
            );
          })}
        </div>

        {/* Terminal Thin Status Bar */}
        <div className="terminal-status-bar">
          <div className="progress-container">
            <span>PROGRES:</span>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <span>{progress}%</span>
          </div>
          <div>
            <span>
              {isFinished
                ? "SELESAI"
                : isPlaying
                  ? `RUNNING (${speedMode === "1x" ? "10s" : speedMode === "2x" ? "5s" : "INSTANT"})`
                  : "READY"}
            </span>
          </div>
        </div>
      </section>

      {/* Clean PDF & Word Report Downloads Box */}
      {isFinished && actionResult?.success && (
        <section className="card download-section">
          <div className="download-title">
            <svg
              style={{ width: 20, height: 20 }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Enkripsi Selesai & Laporan Berhasil Dibuat!</span>
          </div>

          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--text-main)", marginBottom: "0.25rem" }}>
              Ciphertext Hasil (Heks):{" "}
              <code style={{ color: "var(--accent-cyan)", background: "rgba(6, 182, 212, 0.08)", padding: "0.15rem 0.5rem", borderRadius: "4px", fontFamily: "JetBrains Mono, monospace" }}>
                {actionResult.cipherHex?.toUpperCase()}
              </code>
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Unduh langkah pengerjaan komplit untuk tugas Keamanan Informasi Anda:
            </p>
          </div>

          <div className="download-buttons">
            <button className="btn-download docx" onClick={() => handleDownload("docx")}>
              <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Laporan Word (.docx)</span>
            </button>
            <button className="btn-download pdf" onClick={() => handleDownload("pdf")}>
              <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Laporan PDF (.pdf)</span>
            </button>
          </div>
        </section>
      )}

      {/* Minimal Footer */}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} AES Keamanan Informasi Platform - GhaniRahmans</p>
      </footer>

      {/* Embedded Spinner CSS */}
      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
