import { createFileRoute } from "@tanstack/react-router";
import { Check, Crown, Mail, MapPin, Phone } from "lucide-react";
import { PUBLIC_PLANS, formatRupiah } from "@/lib/public-plans";

const ORIGIN = "https://www.enonihongo.com";

export const Route = createFileRoute("/paket")({
  head: () => ({
    meta: [
      { title: "Paket Premium ENO NIHONGO" },
      { name: "description", content: "Pilih paket Premium ENO NIHONGO: bulanan, tahunan, atau lifetime." },
    ],
    links: [{ rel: "canonical", href: `${ORIGIN}/paket` }],
  }),
  component: PaketPage,
});

function PaketPage() {
  return <main className="min-h-screen bg-[#f7fbf8] px-4 py-8 text-[#10221a] sm:py-12">
    <div className="mx-auto max-w-5xl">
      <a href="/" className="text-sm font-bold text-[#087d48]">← ENO NIHONGO</a>
      <section className="mt-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#087d48]/10 px-3 py-1 text-xs font-black text-[#087d48]"><Crown className="size-3.5" /> PAKET PREMIUM</span>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Belajar lebih lengkap sesuai kebutuhanmu.</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">Pilih akses Premium untuk latihan, simulasi, dan ENO Exam Bulanan. Harga ditampilkan dalam Rupiah.</p>
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {PUBLIC_PLANS.map((plan) => <article key={plan.code} className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${plan.featured ? "border-[#087d48] ring-2 ring-[#087d48]/15" : "border-slate-200"}`}>
          {plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#087d48] px-3 py-1 text-[11px] font-black text-white">PALING HEMAT</span>}
          <h2 className="text-lg font-black">{plan.name}</h2>
          <p className="mt-3 text-3xl font-black text-[#087d48]">{formatRupiah(plan.price)}</p>
          <p className="mt-1 text-xs text-slate-500">{plan.billing}</p>
          <p className="mt-5 min-h-10 text-sm leading-5 text-slate-600">{plan.description}</p>
          <ul className="mt-5 space-y-2 text-sm text-slate-700"><li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#087d48]" />Materi dan latihan Premium</li><li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#087d48]" />ENO Exam Bulanan</li><li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#087d48]" />Progres tersimpan di akun</li></ul>
          <a href={`/auth?paket=${plan.code}`} className="mt-7 flex h-11 items-center justify-center rounded-xl bg-[#087d48] px-4 text-sm font-black text-white">Pilih {plan.name}</a>
        </article>)}
      </section>
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-black">Butuh bantuan sebelum membeli?</h2>
        <p className="mt-1 text-sm text-slate-600">Hubungi layanan pelanggan ENO NIHONGO.</p>
        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-3"><a href="mailto:enoinjapan@gmail.com" className="flex gap-3"><Mail className="size-5 shrink-0 text-[#087d48]" /><span><b>Email</b><br />enoinjapan@gmail.com</span></a><a href="tel:082215155915" className="flex gap-3"><Phone className="size-5 shrink-0 text-[#087d48]" /><span><b>Telepon</b><br />082215155915</span></a><div className="flex gap-3"><MapPin className="size-5 shrink-0 text-[#087d48]" /><span><b>Alamat operasional</b><br />Jl. Gagak Gg. Bpk Hasan No. 42, Sadang Serang, Coblong, Bandung</span></div></div>
      </section>
      <p className="mt-5 text-center text-xs leading-5 text-slate-500">Pembelian memerlukan akun Google agar akses Premium dapat dikaitkan dengan akunmu. Pembayaran diproses melalui mitra pembayaran yang tersedia saat checkout.</p>
    </div>
  </main>;
}
