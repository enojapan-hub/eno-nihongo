import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/kebijakan-privasi")({ component: Page });
function Page() {
  return (
    <main className="min-h-screen bg-[#f7faf8] px-4 py-8 text-[#10221a]">
      <article className="mx-auto max-w-2xl rounded-3xl border bg-white p-6 shadow-sm sm:p-9">
        <a href="/" className="text-xs font-bold text-[#087d48]">
          ← ENO NIHONGO
        </a>
        <h1 className="mt-5 text-3xl font-black">Kebijakan Privasi</h1>
        <p className="mt-2 text-xs text-slate-500">Terakhir diperbarui: 30 September 2026</p>
        <div className="mt-7 space-y-5 text-sm leading-6 text-slate-700">
          <p>
            ENO NIHONGO menggunakan data yang diperlukan untuk menyediakan dan mengamankan layanan
            pembelajaran.
          </p>
          <h2 className="font-black">Data yang diproses</h2>
          <p>
            Data dapat mencakup informasi akun yang diberikan saat masuk, profil belajar, progres,
            aktivitas pembelajaran, serta informasi transaksi yang diperlukan untuk mengelola akses
            berbayar.
          </p>
          <h2 className="font-black">Penggunaan data</h2>
          <p>
            Data digunakan untuk autentikasi, personalisasi pembelajaran, penyimpanan progres,
            dukungan pengguna, keamanan, serta administrasi langganan dan pembayaran.
          </p>
          <h2 className="font-black">Pembayaran</h2>
          <p>
            Pembayaran diproses melalui mitra pembayaran. ENO NIHONGO tidak menyimpan nomor kartu,
            PIN, OTP, atau kredensial pembayaran pengguna.
          </p>
        </div>
        <p className="mt-8 border-t pt-5 text-xs text-slate-500">Kontak: enonihongo@gmail.com</p>
      </article>
    </main>
  );
}
