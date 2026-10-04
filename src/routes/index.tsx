import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  FileText,
  Headphones,
  Languages,
  Menu,
  X,
  BookMarked,
  PanelsTopLeft,
  Smartphone,
  Sparkles,
  Instagram,
  ShieldCheck,
  Target,
  Crown,
} from "lucide-react";
import { AuthLoader } from "@/components/layout/AuthLoader";
import { hasStoredSession, initialAuthCallback, resolveAuth } from "@/lib/auth-flow";
const ORIGIN = "https://www.enonihongo.com";
const DESCRIPTION = "Belajar bahasa Jepang dan persiapan JLPT N5–N1 bersama ENO NIHONGO.";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ENO NIHONGO — Belajar Bahasa Jepang & JLPT N5–N1" },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: `${ORIGIN}/` }],
  }),
  component: Home,
});
const features = [
  {
    icon: BookOpen,
    title: "Materi Lengkap N5–N1",
    text: "Kanji, Kotoba, Bunpou, Dokkai, dan Choukai.",
    box: "bg-emerald-50 text-emerald-700",
  },
  {
    icon: Sparkles,
    title: "ENO Kioku",
    text: "Latihan cerdas berdasarkan retensi dan kesalahanmu.",
    box: "bg-rose-50 text-rose-600",
  },
  {
    icon: ClipboardCheck,
    title: "Simulasi JLPT",
    text: "Latihan terstruktur untuk menghadapi ujian.",
    box: "bg-sky-50 text-sky-600",
  },
  {
    icon: Target,
    title: "Target & Progres",
    text: "Pantau perkembangan belajar dengan lebih jelas.",
    box: "bg-violet-50 text-violet-600",
  },
];
const reasons = [
  { icon: BookMarked, title: "Materi N5–N1", text: "Belajar bertahap sesuai target JLPT" },
  {
    icon: PanelsTopLeft,
    title: "Latihan Terintegrasi",
    text: "Quiz, flashcard, dan simulasi dalam satu alur",
  },
  {
    icon: Target,
    title: "Progres Terarah",
    text: "Pantau perkembangan dan lanjutkan dari posisi terakhir",
  },
  { icon: Smartphone, title: "Akses Fleksibel", text: "Belajar nyaman dari perangkatmu" },
];
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[17px] fill-current">
    <path d="M15.2 3c.25 2.1 1.45 3.45 3.8 3.6v3.05c-1.45-.05-2.75-.45-3.8-1.15v6.15A5.35 5.35 0 1 1 10.6 9.3v3.1a2.35 2.35 0 1 0 1.55 2.25V3h3.05Z" />
  </svg>
);
function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  // Callback OAuth/verifikasi atau sesi tersimpan: tampilkan loader (bukan beranda publik)
  // sampai sesi selesai di-resolve, supaya pengguna tidak mengira belum masuk.
  const [resolving, setResolving] = useState(false);
  useEffect(() => {
    let active = true;
    const pending = initialAuthCallback.present || hasStoredSession(window.localStorage);
    if (pending) setResolving(true);
    void resolveAuth()
      .then((result) => {
        if (!active) return;
        if (result.authenticated) {
          window.location.replace(result.destination);
          return;
        }
        if (result.callbackFailed) window.location.replace("/auth?callback=failed");
        else setResolving(false);
      })
      .catch(() => {
        if (active) setResolving(false);
      });
    return () => {
      active = false;
    };
  }, []);
  if (resolving) return <AuthLoader />;
  return (
    <main className="min-h-screen bg-white font-sans text-[#10221a]">
      <header className="sticky top-0 z-50 border-b border-slate-100/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1120px] items-center justify-between px-5 md:px-7">
          <a href="/" className="flex items-center gap-2">
            <img
              src="/enonihongo-logo-light.png"
              alt="Logo ENO NIHONGO"
              className="size-10 object-contain"
            />
            <div>
              <div className="text-[15px] font-black leading-none text-[#17623f]">ENO NIHONGO</div>
              <div className="mt-1 text-[7px] font-medium tracking-wide text-slate-400">
                JAPANESE LEARNING HUB
              </div>
            </div>
          </a>
          <nav className="hidden items-center gap-6 text-[11px] font-bold text-slate-600 md:flex">
            <a className="hover:text-[#087d48]" href="#fitur">
              Fitur
            </a>
            <a className="hover:text-[#087d48]" href="#materi">
              Materi
            </a>
            <a className="hover:text-[#087d48]" href="/simulasi">
              Simulasi
            </a>
            <a className="hover:text-[#087d48]" href="#akses">
              Harga
            </a>
            <a href="/auth" className="rounded-full bg-[#087d48] px-4 py-2.5 text-white">
              Mulai Belajar
            </a>
          </nav>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu navigasi"
            aria-expanded={menuOpen}
            className="grid size-10 place-items-center rounded-full border border-slate-200 md:hidden"
          >
            {menuOpen ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
          </button>
        </div>
        {menuOpen && (
          <nav className="border-t border-slate-100 bg-white px-5 py-4 md:hidden">
            <div className="mx-auto grid max-w-md gap-1 text-sm font-bold text-slate-700">
              {[
                ["Fitur", "#fitur"],
                ["Materi", "#materi"],
                ["Simulasi", "/simulasi"],
                ["Harga", "#akses"],
                ["Tentang", "#kenapa"],
              ].map(([label, to]) => (
                <a
                  key={label}
                  onClick={() => setMenuOpen(false)}
                  href={to}
                  className="rounded-xl px-3 py-3 hover:bg-emerald-50"
                >
                  {label}
                </a>
              ))}
              <a
                href="/auth"
                className="mt-2 flex h-11 items-center justify-center rounded-xl bg-[#087d48] text-white"
              >
                Mulai Belajar Gratis
              </a>
            </div>
          </nav>
        )}
      </header>
      <section className="relative overflow-hidden bg-[#eaf6f0]">
        <img
          src="/eno-hero.png"
          alt="Pemandangan Jepang ENO NIHONGO"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/55 to-white/5 md:from-white/95 md:via-white/55" />
        <div className="relative mx-auto max-w-[1120px] px-5 pt-7 md:min-h-[500px] md:px-7 md:py-10">
          <div className="relative z-20 md:max-w-[570px]">
            <p className="text-[9px] font-black tracking-[.2em] text-[#167347] md:text-[11px]">
              BELAJAR TERARAH · JLPT N5–N1
            </p>
            <h1 className="mt-3 text-[32px] font-black leading-[1.02] tracking-[-.04em] md:text-[48px]">
              Bahasa Jepang,
              <br />
              <span className="text-[#087d48]">lebih terarah.</span>
            </h1>
            <p className="mt-4 max-w-[500px] pr-[34%] text-[11px] leading-[1.55] text-slate-700 md:pr-0 md:text-[14px]">
              Belajar Kanji, Kotoba, Bunpou, Dokkai, Choukai, dan persiapan JLPT dalam satu
              pengalaman belajar yang terstruktur.
            </p>
            <div className="mt-5 hidden gap-3 md:flex">
              <a
                href="/auth"
                className="flex items-center gap-2 rounded-full bg-[#087d48] px-5 py-3 text-[12px] font-bold text-white"
              >
                Mulai Belajar dengan Google <ArrowRight className="size-4" />
              </a>
              <a
                href="#fitur"
                className="flex items-center gap-2 rounded-full border border-[#087d48] bg-white px-5 py-3 text-[12px] font-bold text-[#17623f]"
              >
                Lihat Fitur <ArrowRight className="size-4" />
              </a>
            </div>
          </div>
          <div className="mt-6 hidden items-center gap-4 text-[10px] font-semibold text-slate-600 md:flex">
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-4 text-[#087d48]" />
              Mulai gratis
            </span>
            <span className="flex items-center gap-1">
              <Target className="size-4 text-[#087d48]" />
              Target JLPT personal
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="size-4 text-[#087d48]" />
              Belajar adaptif
            </span>
          </div>
        </div>
        <div className="h-[315px] md:h-[260px]" />
        <div className="absolute bottom-[-1px] left-0 right-0 z-30 h-5 rounded-[50%_50%_0_0/100%_100%_0_0] bg-white" />
      </section>
      <section className="bg-white px-5 pb-3 pt-3 md:hidden">
        <div className="mx-auto grid max-w-md gap-2.5">
          <a
            href="/auth"
            className="flex h-[50px] items-center justify-center gap-2 rounded-full bg-[#087d48] text-[12px] font-bold text-white"
          >
            ⓖ Mulai Belajar dengan Google <ArrowRight className="size-4" />
          </a>
          <a
            href="#fitur"
            className="flex h-[46px] items-center justify-center gap-2 rounded-full border border-[#087d48] text-[12px] font-bold text-[#17623f]"
          >
            Lihat Fitur <ArrowRight className="size-4" />
          </a>
        </div>
      </section>
      <section id="fitur" className="px-4 py-8 md:py-12">
        <div className="mx-auto max-w-[1060px]">
          <div className="mb-5 text-center">
            <p className="text-[9px] font-black tracking-[.18em] text-[#087d48]">
              SATU TEMPAT UNTUK BELAJAR
            </p>
            <h2 className="mt-2 text-[22px] font-black md:text-[28px]">
              Persiapan Jepang yang lebih lengkap
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
            {features.map((f) => {
              const I = f.icon;
              return (
                <article
                  key={f.title}
                  className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_6px_24px_rgba(35,70,50,.06)]"
                >
                  <div className={`grid size-11 place-items-center rounded-xl ${f.box}`}>
                    {typeof I === "string" ? (
                      <span className="text-lg font-black">{I}</span>
                    ) : (
                      <I className="size-[18px]" />
                    )}
                  </div>
                  <h2 className="mt-3 text-[12px] font-black">{f.title}</h2>
                  <p className="mt-1 text-[9px] leading-[1.45] text-slate-500">{f.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section id="materi" className="px-4 py-7 md:py-10">
        <div className="mx-auto max-w-[1060px]">
          <p className="text-[9px] font-black tracking-[.18em] text-[#087d48]">
            PILIH LEVEL BELAJAR
          </p>
          <div className="mt-2 flex items-end justify-between">
            <h2 className="text-[20px] font-black md:text-[25px]">
              Mulai dari level yang sesuai dengan tujuanmu
            </h2>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {[
              ["N5", "Pemula"],
              ["N4", "Dasar"],
              ["N3", "Menengah"],
              ["N2", "Lanjutan"],
              ["N1", "Mahir"],
            ].map(([level, label], i) => (
              <div
                key={level}
                className={`rounded-2xl border p-3 text-center ${i === 0 ? "border-emerald-300 bg-emerald-50" : "border-slate-100 bg-white"}`}
              >
                <span className="text-sm font-black text-[#087d48]">{level}</span>
                <p className="mt-1 hidden text-[8px] text-slate-500 sm:block">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="akses" className="px-4 py-10">
        <div className="mx-auto max-w-[1060px]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-black tracking-[.18em] text-[#087d48]">AKSES BELAJAR</p>
              <h2 className="mt-2 text-[22px] font-black">Mulai gratis, tingkatkan saat siap.</h2>
              <p className="mt-1 text-[10px] text-slate-500">
                Pilih akses sesuai perjalanan belajarmu.
              </p>
            </div>
            <Crown className="hidden size-8 text-amber-500 sm:block" />
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-xl bg-[#fbfcfb] p-3 shadow-sm">
              <div className="flex gap-2">
                <span className="text-xl">🌱</span>
                <div>
                  <h3 className="text-[11px] font-black">Gratis</h3>
                  <p className="text-[8px] text-slate-500">Materi dasar & latihan harian</p>
                </div>
              </div>
              <a
                href="/auth"
                className="mt-3 flex justify-center rounded-lg border border-[#087d48] py-2 text-[9px] font-bold text-[#087d48]"
              >
                Mulai Gratis →
              </a>
            </article>
            {[
              ["Premium Bulanan", "Rp50.000 / bulan"],
              ["Premium Tahunan", "Rp350.000 / tahun"],
              ["Lifetime", "Rp1.500.000 sekali bayar"],
            ].map(([name, price]) => (
              <article key={name} className="rounded-xl bg-[#fbfcfb] p-3 shadow-sm">
                <div className="flex gap-2">
                  <span className="text-xl">👑</span>
                  <div>
                    <h3 className="text-[11px] font-black">{name}</h3>
                    <p className="text-[8px] text-slate-500">{price}</p>
                  </div>
                </div>
                <a
                  href="/paket"
                  className="mt-3 flex justify-center rounded-lg bg-[#087d48] py-2 text-[9px] font-bold text-white"
                >
                  Lihat Paket →
                </a>
              </article>
            ))}
          </div>
          <a href="/paket" className="mt-4 inline-flex text-[11px] font-bold text-[#087d48]">
            Lihat rincian paket dan pembelian →
          </a>
        </div>
      </section>
      <section id="kenapa" className="scroll-mt-20 bg-[#f8fcfa] px-4 py-8 md:py-10">
        <div className="mx-auto max-w-[1060px]">
          <h2 className="text-[19px] font-black md:text-[24px]">Kenapa Memilih ENO NIHONGO?</h2>
          <p className="mt-1 text-[10px] text-slate-500 md:text-[12px]">
            Sistem belajar yang jelas, terstruktur, dan tetap sederhana digunakan.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {reasons.map((r) => {
              const I = r.icon;
              return (
                <article key={r.title} className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                      <I className="size-[18px]" />
                    </div>
                    <div>
                      <h3 className="text-[10px] font-black leading-tight">{r.title}</h3>
                      <p className="mt-1 text-[8px] leading-snug text-slate-500">{r.text}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-900/10 bg-white p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-[16px] font-black text-[#075f3f]">Siap mulai belajar?</h2>
              <p className="mt-1 text-[9px] text-slate-600 md:text-[11px]">
                Mulai gratis dan susun perjalanan belajar sesuai target JLPT-mu.
              </p>
            </div>
            <a
              href="/auth"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#087d48] px-5 py-2.5 text-[10px] font-black text-white"
            >
              Mulai Gratis <ArrowRight className="size-3.5" />
            </a>
          </div>
        </div>
      </section>
      <footer className="border-t border-slate-100 bg-white px-5 py-5 md:py-7">
        <div className="mx-auto max-w-[1060px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <a href="/" className="inline-flex items-center gap-2">
                <img
                  src="/enonihongo-logo-light.png"
                  alt="ENO NIHONGO"
                  className="size-11 object-contain md:size-10"
                />
                <div>
                  <div className="text-[16px] font-black leading-none text-[#17623f]">
                    ENO NIHONGO
                  </div>
                  <div className="mt-1 text-[8px] text-slate-400">Your Japanese Learning Hub</div>
                </div>
              </a>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500 md:text-[12px]">
                Belajar lebih jauh, capai lebih banyak.
              </p>
            </div>
            <div className="shrink-0">
              <b className="text-[12px] md:text-[13px]">Ikuti Kami</b>
              <div className="mt-2 flex gap-2">
                <a
                  href="https://www.instagram.com/enottf/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram @enottf"
                  className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-700 transition hover:border-[#087d48] hover:bg-emerald-50 hover:text-[#087d48]"
                  title="Instagram @enottf"
                >
                  <Instagram className="size-[17px]" strokeWidth={2.2} />
                </a>
                <a
                  href="https://www.tiktok.com/@enottff"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="TikTok @enottff"
                  className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-700 transition hover:border-[#087d48] hover:bg-emerald-50 hover:text-[#087d48]"
                  title="TikTok @enottff"
                >
                  <TikTokIcon />
                </a>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-[1.4fr_.6fr] gap-5 border-t border-slate-100 pt-4 md:grid-cols-[1fr_1fr]">
            <div>
              <b className="text-[12px] md:text-[13px]">Menu</b>
              <nav className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2 text-[11px] leading-relaxed text-slate-600 md:max-w-[440px] md:text-[12px]">
                <a href="/">Beranda</a>
                <a href="#fitur">Fitur</a>
                <a href="#materi">Materi</a>
                <a href="/simulasi">Simulasi</a>
                <a href="#akses">Harga</a>
                <a href="#kenapa">Tentang</a>
              </nav>
            </div>
            <div>
              <b className="text-[12px] md:text-[13px]">Akun</b>
              <nav className="mt-2 grid gap-2 text-[11px] leading-relaxed text-slate-600 md:text-[12px]">
                <a href="/auth">Masuk</a>
                <a href="/auth">Mulai Gratis</a>
              </nav>
            </div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-600 md:text-[12px]">
            <b>Layanan Pelanggan</b>
            <div className="mt-2 grid gap-1 sm:grid-cols-3">
              <a href="mailto:enoinjapan@gmail.com">Email: enoinjapan@gmail.com</a>
              <a href="tel:082215155915">Telepon: 082215155915</a>
              <p>Alamat: Jl. Gagak Gg. Bpk Hasan No. 42, Sadang Serang, Coblong, Bandung</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
            <a
              href="/syarat-ketentuan"
              className="text-[10px] font-semibold text-slate-600 hover:text-[#087d48]"
            >
              Syarat & Ketentuan
            </a>
            <a
              href="/kebijakan-privasi"
              className="text-[10px] font-semibold text-slate-600 hover:text-[#087d48]"
            >
              Kebijakan Privasi
            </a>
            <a
              href="/kebijakan-pembayaran"
              className="text-[10px] font-semibold text-slate-600 hover:text-[#087d48]"
            >
              Pembayaran & Pengembalian Dana
            </a>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[9px] text-slate-400 md:text-[10px]">
            <span>© {new Date().getFullYear()} ENO NIHONGO. Semua hak dilindungi.</span>
            <span>Belajar bahasa Jepang · JLPT N5–N1</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
