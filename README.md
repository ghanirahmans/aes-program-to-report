# AESVisual 🔐

**AESVisual** adalah platform visualisasi interaktif algoritma kriptografi **AES-128** (Advanced Encryption Standard) berbasis web yang dirancang khusus untuk kebutuhan akademis Keamanan Informasi. Aplikasi ini mensimulasikan setiap langkah matematis enkripsi secara mendalam (SubBytes, ShiftRows, MixColumns, AddRoundKey) dan menyediakan generator otomatis laporan tugas kuliah komplit dalam format Word (.docx) & PDF.

Aplikasi ini dilengkapi dengan modul komersial terintegrasi dengan payment gateway **Midtrans Secure Pay** (QRIS, E-Wallet, Transfer Bank) untuk pembelian token lisensi sekali pakai.

---

## ✨ Fitur Unggulan

1. **Interactive State Matrix (4x4 Grid)**
   * Pemetaan visual *Column-Major Order* secara real-time pada Plaintext & Cipher Key sesuai standar kriptografi FIPS-197. User dapat langsung melihat bagaimana karakter ASCII/Hex dikonversi ke dalam koordinat matriks state $s_{r,c}$.

2. **IDE-Grade Terminal Visualizer**
   * Output visual log yang mensimulasikan jalannya compiler secara real-time. Dilengkapi dengan pengaturan kecepatan simulasi (1X, 2X, SKIP) dan visualisasi matematis polinomial Galois Field ($GF(2^8)$).

3. **Generator Laporan Akademik Otomatis**
   * Menghasilkan dokumen pengerjaan langkah-per-langkah secara instan pasca enkripsi sukses dalam format:
     * **Microsoft Word (.docx)** - Siap diedit untuk tugas.
     * **Adobe PDF (.pdf)** - Format siap kumpul.
     * **Arsip (.zip)** - Berisi paket file lengkap.

4. **SaaS Billing & Token Activation**
   * Modul pembelian token lisensi menggunakan payment gateway resmi **Midtrans Snap (Sesi Unik)**.
   * **Akses Uji Coba (Demo)** gratis secara offline untuk kebutuhan ujicoba internal/presentasi developer.
   * Sistem validasi token otomatis (`Prisma & Database Lock API`) sekali pakai demi keamanan tinggi.

---

## 🛠️ Arsitektur & Teknologi

* **Frontend:** Next.js (React), HSL Design Tokens, Vanilla CSS Glassmorphism
* **Backend:** Next.js Server Actions, Next.js API Routes (Route Handlers)
* **Database & ORM:** Prisma ORM dengan PostgreSQL / MySQL
* **Payment Gateway:** Midtrans Snap API (Sandbox & Production Ready)
* **Library Ekspor:** AdmZip, Docx Generator, PDF Rendering Engines

---

## 📂 Struktur Direktori Utama

```text
├── prisma/                 # Skema Database (Prisma Schema & Migrasi)
├── src/
│   ├── app/                # Next.js App Router (Pages, APIs, & Layouts)
│   │   ├── api/            # API Route Handlers (License, Admin, Webhook)
│   │   ├── buy-token/      # Portal Pembelian Token & Success Verifier
│   │   ├── globals.css     # Sistem token warna & layouting responsive
│   │   ├── page.tsx        # Dashboard Visualisasi Enkripsi Utama
│   │   └── layout.tsx      # Kerangka navigasi atas (AESVisual Top Nav)
│   ├── lib/                # Logika Enkripsi AES-128, Lisensi, & Generator Laporan
│   └── scripts/            # Script Utilitas & Pembuat Laporan Manual
├── scratch/                # File temporer pengiriman log email lokal
└── tmp_reports/            # Folder temporer konversi berkas laporan
```

---

## ⚙️ Konfigurasi Environment (`.env`)

Buat file `.env` pada direktori root proyek dan isi parameter berikut:

```env
# URL Koneksi Database
DATABASE_URL="postgresql://user:password@localhost:5432/aesvisual"

# API Key untuk Panel Admin (Proteksi Revoke Token)
ADMIN_API_KEY="AES_ADMIN_SECURE_KEY_123"

# Kredensial Payment Gateway Midtrans (Ganti ke Production Key saat Live)
MIDTRANS_SERVER_KEY="SB-Mid-server-..."
MIDTRANS_CLIENT_KEY="SB-Mid-client-..."

# Server Pengiriman Email (SMTP / Mail Server) untuk Token Lisensi
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT=2525
SMTP_USER="user-smtp"
SMTP_PASS="pass-smtp"
SMTP_FROM="noreply@aesvisual.com"
```

---

## 🚀 Panduan Instalasi & Penggunaan Lokal

### 1. Kloning & Instalasi Dependensi
```bash
# Masuk ke folder program
npm install
```

### 2. Jalankan Migrasi Database
Pastikan server database (PostgreSQL / MySQL) Anda sudah aktif dan `DATABASE_URL` di `.env` sudah benar.
```bash
npx prisma db push
```

### 3. Jalankan Server Development
```bash
npm run dev
```
Aplikasi Anda akan aktif di **[http://localhost:3000](http://localhost:3000)**.

### 4. Build untuk Lingkungan Produksi
Untuk memastikan performa optimal dan kompilasi bersih sebelum proses deploy:
```bash
npm run build
npm start
```

---

## 🔒 Keamanan & Ketentuan Lisensi

Setiap token lisensi yang dibeli melalui **AESVisual** dilindungi dengan hashing searah di database. 
* Token bersifat **Sekali Pakai (One-Time Use)**.
* Setelah menekan tombol **Proses Enkripsi**, status token diubah menjadi `USED` secara *atomic transaction* guna mencegah pemakaian berulang.
* Semua transaksi pembayaran diamankan langsung melalui API notifikasi (webhook) Midtrans.

---

## 👨‍💻 Kontributor
* **GhaniRahmans** (AES Keamanan Informasi Platform Developer)
* Redesigned UI/UX Portal by **Antigravity**
