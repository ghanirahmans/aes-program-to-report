import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AES Keamanan Informasi - Dashboard & Generator Laporan",
  description: "Aplikasi visualisasi enkripsi AES dan generator laporan DOCX & PDF otomatis untuk tugas Keamanan Informasi.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

