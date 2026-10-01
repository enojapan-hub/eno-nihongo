import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/syarat-ketentuan")({ component: Page });
function Page() {
  return (
    <main className="min-h-screen bg-[#f7faf8] px-4 py-8 text-[#10221a]">
      <article className="mx-auto max-w-2xl rounded-3xl border bg-white p-6 shadow-sm sm:p-9">
        <a href="/" className="text-xs font-bold text-[#087d48]">
          ← ENO NIHONGO
        </a>
        <h1 className="mt-5 text-3xl font-black">Syarat & Ketentuan</h1>
        <p className="mt-2 text-xs text-slate-500">Terakhir diperbarui: 30 September 2026</p>
        <div className="mt-7 space-y-5 text-sm leading-6 text-slate-700">
          <p>
            Dengan menggunakan ENO NIHONGO, pengguna menyetujui ketentuan penggunaan layanan
            pembelajaran digital ini.
          </p>
          <h2 className="font-black">Akun dan layanan</h2>
          <p>
            Akun digunakan untuk mengakses materi, latihan, progres belajar, kelas, simulasi, dan
            fitur lain sesuai jenis akses pengguna. Pengguna bertanggung jawab menjaga keamanan
            akun.
          </p>
          <h2 className="font-black">Akses Premium</h2>
          <p>
            Fitur Premium diberikan sesuai paket dan masa akses yang tercantum saat pembelian. Harga
            dan periode paket ditampilkan sebelum pembayaran.
          </p>
          <h2 className="font-black">Konten pembelajaran</h2>
          <p>
            Materi ditujukan sebagai sarana belajar dan persiapan. ENO NIHONGO tidak menjamin hasil
            atau kelulusan ujian tertentu.
          </p>
        </div>
        <p className="mt-8 border-t pt-5 text-xs text-slate-500">
          Pertanyaan: enoinjapan@gmail.com
        </p>
      </article>
    </main>
  );
}
