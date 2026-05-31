import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AES Keamanan Informasi - Dashboard & Generator Laporan",
  description: "Aplikasi visualisasi enkripsi AES dan generator laporan DOCX & PDF otomatis untuk tugas Keamanan Informasi.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <nav className="navbar">
          <div className="navbar-container">
            <Link href="/" className="navbar-brand">
              <span className="brand-dot"></span>
              AES Keamanan Informasi
            </Link>
            <div className="navbar-links">
              <Link href="/" className="nav-link">Dashboard</Link>
              <Link href="/buy-token" className="nav-link nav-link-highlight">Beli Token</Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}

