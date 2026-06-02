import Link from "next/link";

export default function LearnAesPage() {
  return (
    <div className="app-container" style={{ maxWidth: "800px" }}>
      <header className="header">
        <h1>Panduan Belajar Kriptografi AES-128</h1>
        <p>
          Pelajari konsep teori, struktur data, dan langkah-langkah perhitungan matematis dari standar enkripsi simetris Advanced Encryption Standard (AES) secara gratis.
        </p>
      </header>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h2>1. Pengantar AES (Advanced Encryption Standard)</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
          AES adalah algoritma kriptografi kunci-simetris standar industri yang digunakan secara global untuk mengamankan data sensitif. AES beroperasi pada blok data berukuran <strong>128 bit</strong> (16 byte) menggunakan kunci berukuran 128, 192, atau 256 bit. Pada platform ini, simulasi berfokus pada <strong>AES-128</strong> yang menggunakan kunci 128 bit dan terdiri dari <strong>10 ronde (putaran)</strong> perhitungan.
        </p>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
          Selama enkripsi, blok input 16-byte dipetakan ke dalam matriks dua dimensi berukuran 4x4 byte yang disebut sebagai <strong>State Matrix</strong>. Struktur kolom-utama (*column-major order*) digunakan untuk mengisi matriks ini.
        </p>
      </section>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h2>2. Struktur Siklus Enkripsi AES-128</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
          Proses enkripsi AES-128 terdiri dari siklus terstruktur dengan langkah-langkah berikut:
        </p>
        <ul style={{ color: "var(--text-secondary)", fontSize: "0.95rem", paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li><strong>Ronde 0 (Inisialisasi):</strong> Menjalankan proses <em>AddRoundKey</em> untuk melakukan operasi logika XOR antara Plaintext awal dengan Kunci Awal (Cipher Key).</li>
          <li><strong>Ronde 1 sampai 9 (Ronde Standar):</strong> Menjalankan empat transformasi berurutan secara berulang pada setiap putaran:
            <ol style={{ paddingLeft: "1.2rem", marginTop: "4px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li><strong>SubBytes:</strong> Substitusi nilai byte menggunakan tabel S-Box nonlinear.</li>
              <li><strong>ShiftRows:</strong> Pergeseran baris matriks State secara berputar ke arah kiri.</li>
              <li><strong>MixColumns:</strong> Pengalian kolom-kolom matriks State dengan polinomial tetap dalam GF(2^8).</li>
              <li><strong>AddRoundKey:</strong> Operasi XOR matriks State hasil transformasi dengan Round Key.</li>
            </ol>
          </li>
          <li><strong>Ronde 10 (Ronde Akhir):</strong> Sama seperti ronde standar, tetapi tanpa langkah <strong>MixColumns</strong>. Proses diakhiri dengan AddRoundKey untuk menghasilkan Ciphertext final.</li>
        </ul>
      </section>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <h2>3. Penjelasan Transformasi Langkah Demi Langkah</h2>
        
        <div style={{ borderBottom: "1px dashed var(--panel-border)", paddingBottom: "1rem" }}>
          <h3 style={{ color: "var(--accent-cyan)", marginBottom: "0.5rem" }}>A. SubBytes</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
            SubBytes melakukan substitusi byte-per-byte secara independen menggunakan tabel pencarian (S-Box). S-Box dibentuk melalui invers perkalian di medan berhingga GF(2^8) yang digabungkan dengan transformasi afin. Langkah ini memperkenalkan sifat non-linearitas untuk mengaburkan relasi antara plaintext dan ciphertext (prinsip konfusi).
          </p>
        </div>

        <div style={{ borderBottom: "1px dashed var(--panel-border)", paddingBottom: "1rem" }}>
          <h3 style={{ color: "var(--accent-purple)", marginBottom: "0.5rem" }}>B. ShiftRows</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
            ShiftRows melakukan pergeseran byte pada baris-baris State secara melingkar ke kiri:
          </p>
          <ul style={{ color: "var(--text-secondary)", fontSize: "0.9rem", paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
            <li>Baris ke-0 tidak digeser sama sekali.</li>
            <li>Baris ke-1 digeser ke kiri sejauh 1 byte.</li>
            <li>Baris ke-2 digeser ke kiri sejauh 2 byte.</li>
            <li>Baris ke-3 digeser ke kiri sejauh 3 byte.</li>
          </ul>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6, marginTop: "0.5rem" }}>
            Langkah ini memastikan bahwa byte-byte dari kolom yang sama disebarkan ke kolom yang berbeda pada langkah berikutnya (prinsip difusi).
          </p>
        </div>

        <div style={{ borderBottom: "1px dashed var(--panel-border)", paddingBottom: "1rem" }}>
          <h3 style={{ color: "var(--accent-emerald)", marginBottom: "0.5rem" }}>C. MixColumns</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
            MixColumns memperlakukan setiap kolom matriks State sebagai polinomial derajat empat di atas medan Galois GF(2^8). Setiap kolom dikalikan dengan matriks polinomial konstan yang memiliki koefisien khusus (2, 3, 1, 1). Operasi perkalian ini menggunakan aritmatika sisa polinomial taktereduksi m(x) = x^8 + x^4 + x^3 + x + 1. Langkah ini memberikan difusi tingkat tinggi di seluruh kolom data.
          </p>
        </div>

        <div>
          <h3 style={{ color: "var(--accent-amber)", marginBottom: "0.5rem" }}>D. AddRoundKey</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
            AddRoundKey menggabungkan State saat ini dengan kunci putaran (Round Key) yang sesuai menggunakan operasi Bitwise XOR. Kunci putaran diperoleh melalui fungsi **Key Expansion** dari Kunci Utama (Cipher Key) asli.
          </p>
        </div>
      </section>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", border: "1px solid var(--accent-cyan-border)", background: "linear-gradient(to bottom, rgba(6, 182, 212, 0.04), transparent)" }}>
        <h2>Butuh Perhitungan Langkah Demi Langkah untuk Tugas Akademik?</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
          Teori di atas adalah dasar pembelajaran algoritma AES. Jika Anda memerlukan simulasi dinamis berbasis data masukan Anda sendiri, lengkap dengan log komputasi 4x4 matriks step-by-step tiap ronde, dan ingin mengunduh laporannya dalam dokumen Word (.docx) atau PDF resmi untuk tugas kuliah Anda, Anda dapat menggunakan layanan generator premium kami.
        </p>
        <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
          <Link href="/buy-token" className="btn-process btn-midtrans" style={{ textDecoration: "none" }}>
            Beli Token Lisensi Premium
          </Link>
          <Link href="/" className="btn-download" style={{ textDecoration: "none" }}>
            Kembali ke Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
