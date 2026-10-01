import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/kebijakan-pembayaran")({ component: Page });
function Page() {
  return (
    <main className="min-h-screen bg-[#f7faf8] px-4 py-8 text-[#10221a]">
      <article className="mx-auto max-w-2xl rounded-3xl border bg-white p-6 shadow-sm sm:p-9">
        <a href="/" className="text-xs font-bold text-[#087d48]">
          ← ENO NIHONGO
        </a>
        <h1 className="mt-5 text-3xl font-black">Pembayaran & Pengembalian Dana</h1>
        <p className="mt-2 text-xs text-slate-500">Terakhir diperbarui: 30 September 2026</p>
        <div className="mt-7 space-y-5 text-sm leading-6 text-slate-700">
          <h2 className="font-black">Pembayaran</h2>
          <p>
            Harga dan periode akses ditampilkan sebelum checkout. Akses berbayar diaktifkan setelah
            pembayaran berhasil dikonfirmasi oleh sistem.
          </p>
          <h2 className="font-black">Pengembalian dana</h2>
          <p>
            Permintaan pengembalian dana dapat diajukan apabila pembayaran berhasil tetapi akses
            yang dibeli tidak diterima karena kesalahan sistem ENO NIHONGO, atau terjadi pembayaran
            ganda untuk transaksi yang sama. Permintaan diperiksa berdasarkan catatan transaksi.
          </p>
          <h2 className="font-black">Bantuan transaksi</h2>
          <p>
            Hubungi layanan pelanggan dengan email akun dan nomor transaksi. Jangan mengirim PIN,
            kata sandi, OTP, atau informasi rahasia pembayaran.
          </p>
        </div>
        <div className="mt-8 rounded-2xl bg-emerald-50 p-4 text-xs">
          <b>Layanan pelanggan</b>
          <p className="mt-1">enoinjapan@gmail.com · 082215155915</p>
        </div>
      </article>
    </main>
  );
}
