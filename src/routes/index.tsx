import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, ClipboardCheck, FileText, Headphones, Languages, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ORIGIN = "https://www.enonihongo.com";
const MASCOT = "https://raw.githubusercontent.com/enojapan-hub/eno-nihongo/assets/eno-mascot/public/eno-mascot.webp";
const DESCRIPTION = "Belajar bahasa Jepang dan persiapan JLPT N5–N1 bersama ENO NIHONGO: kanji, kosakata, bunpou, dokkai, choukai, latihan, dan simulasi JLPT.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ENO NIHONGO — Belajar Bahasa Jepang & JLPT N5–N1" },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:title", content: "ENO NIHONGO — Belajar Bahasa Jepang & JLPT N5–N1" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${ORIGIN}/` },
    ],
    links: [{ rel: "canonical", href: `${ORIGIN}/` }],
  }),
  component: Home,
});

const features = [
  { icon: "漢", title: "Kanji", text: "Dari dasar hingga N1", box: "bg-emerald-50 text-emerald-700" },
  { icon: BookOpen, title: "Kosakata", text: "Ribuan kata dengan contoh", box: "bg-sky-50 text-sky-600" },
  { icon: FileText, title: "Bunpou", text: "Penjelasan mudah dipahami", box: "bg-rose-50 text-rose-600" },
  { icon: Headphones, title: "Choukai", text: "Latihan audio JLPT", box: "bg-violet-50 text-violet-600" },
  { icon: Languages, title: "Dokkai", text: "Tingkatkan kemampuan baca", box: "bg-amber-50 text-amber-600" },
  { icon: ClipboardCheck, title: "Simulasi", text: "Latihan soal seperti ujian", box: "bg-emerald-50 text-emerald-700" },
];

function Home() {
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("onboarding_completed,role").eq("id", user.id).maybeSingle();
        const role = profile?.role ?? "student";
        window.location.replace(role === "owner" || role === "admin" ? "/admin" : profile?.onboarding_completed ? "/dashboard" : "/onboarding");
      } catch { /* keep public home visible */ }
    })();
  }, []);

  return <main className="min-h-screen bg-[#fbfaf7] font-sans text-[#17231d]">
    <header className="relative z-50 border-b border-black/[.04] bg-[#fffefb]">
      <div className="mx-auto flex h-[64px] max-w-[1120px] items-center justify-between px-5 sm:px-7">
        <a href="/" className="flex items-center gap-2.5">
          <img src="/enonihongo-logo-light.png" alt="Logo ENO NIHONGO" className="h-10 w-10 object-contain" />
          <div className="leading-none"><div className="text-[16px] font-extrabold tracking-[-.025em] text-[#17623f] sm:text-[18px]">ENO NIHONGO</div><div className="mt-1 text-[8px] font-medium tracking-[.01em] text-slate-400 sm:text-[9px]">Your Japanese Learning Hub</div></div>
        </a>
        <nav className="hidden items-center gap-7 text-[13px] font-semibold text-slate-600 md:flex"><a href="#fitur">Fitur</a><a href="#materi">Materi</a><a href="#akses">Akses</a></nav>
        <div className="flex items-center gap-2"><a href="/auth" className="rounded-full bg-[#167347] px-4 py-2.5 text-[12px] font-bold text-white sm:px-5 sm:text-[13px]">Mulai Gratis</a><button aria-label="Menu" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white md:hidden"><Menu className="size-[18px]" /></button></div>
      </div>
    </header>

    <section className="relative overflow-hidden bg-[#eef8ff]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,.96)_0,rgba(255,255,255,.15)_30%,transparent_45%),radial-gradient(circle_at_88%_14%,rgba(255,219,230,.55)_0,transparent_32%),linear-gradient(180deg,#eaf7ff_0%,#f5fbf7_58%,#fffdf8_100%)]" />
      <div className="relative mx-auto grid max-w-[1120px] px-5 pb-10 pt-9 sm:px-7 md:min-h-[570px] md:grid-cols-[1.02fr_.98fr] md:items-center md:gap-8 md:pb-16 md:pt-14">
        <div className="z-10 max-w-[560px]">
          <p className="text-[10px] font-extrabold tracking-[.23em] text-[#23805a] sm:text-[11px]">BELAJAR · LATIH · CAPAI · JLPT</p>
          <h1 className="mt-3 text-[35px] font-black leading-[1.035] tracking-[-.045em] sm:text-[46px] lg:text-[55px]">Wujudkan Kemampuan Bahasa Jepang <span className="text-[#167347]">Versi Terbaikmu</span></h1>
          <p className="mt-4 max-w-[520px] text-[13px] leading-[1.65] text-slate-600 sm:text-[15px]">ENO NIHONGO adalah platform belajar bahasa Jepang untuk persiapan JLPT N5–N1. Belajar lebih terarah, praktis, dan menyenangkan.</p>
          <div className="mt-5 grid gap-2.5 sm:flex"><a href="/auth" className="flex items-center justify-center gap-2 rounded-xl bg-[#167347] px-5 py-3 text-[13px] font-extrabold text-white shadow-sm">Mulai Belajar Gratis <ArrowRight className="size-4" /></a><a href="#fitur" className="flex items-center justify-center gap-2 rounded-xl border border-[#167347]/30 bg-white/80 px-5 py-3 text-[13px] font-extrabold text-[#17623f]">Lihat Fitur <ArrowRight className="size-4" /></a></div>
        </div>
        <div className="relative mx-auto mt-4 h-[305px] w-full max-w-[430px] md:mt-0 md:h-[455px]">
          <div className="absolute right-1 top-4 z-20 rounded-[14px] border border-white bg-white/92 px-3 py-2 text-center shadow-[0_10px_30px_rgba(30,60,50,.08)] sm:right-3"><p className="text-[13px] font-black">一緒に頑張ろう!</p><p className="mt-.5 text-[9px] font-semibold text-[#23805a]">Ayo belajar bersama!</p></div>
          <div className="absolute bottom-3 left-1/2 h-12 w-[70%] -translate-x-1/2 rounded-[50%] bg-[#235a42]/10 blur-xl" />
          <img src={MASCOT} alt="Maskot ENO NIHONGO" className="absolute bottom-0 left-1/2 z-10 h-[300px] max-w-none -translate-x-1/2 object-contain drop-shadow-[0_20px_18px_rgba(24,71,50,.12)] md:h-[445px]" />
        </div>
      </div>
    </section>

    <section id="fitur" className="bg-[#fffdf9] px-4 pb-6 pt-5 sm:px-6"><div className="mx-auto max-w-[1060px] rounded-[22px] border border-black/[.045] bg-white px-2 py-3 shadow-[0_8px_30px_rgba(40,60,50,.045)] sm:px-4 sm:py-4"><div className="grid grid-cols-3 md:grid-cols-6">{features.map((f, i) => { const Icon = f.icon; return <article key={f.title} className={`px-1.5 py-2 text-center sm:px-3 ${i !== 0 ? "border-l border-slate-100" : ""}`}><div className={`mx-auto grid h-10 w-10 place-items-center rounded-[13px] ${f.box}`}>{typeof Icon === "string" ? <span className="text-[19px] font-black">{Icon}</span> : <Icon className="size-[19px]" />}</div><h2 className="mt-2 text-[11px] font-extrabold sm:text-[12px]">{f.title}</h2><p className="mt-1 hidden text-[9px] leading-4 text-slate-400 sm:block">{f.text}</p></article> })}</div></div></section>

    <section id="materi" className="bg-[#fffdf9] px-4 py-4 sm:px-6"><div className="relative mx-auto max-w-[1060px] overflow-hidden rounded-[24px] border border-[#dceee4] bg-[#f3faf5] p-6 sm:p-8"><span className="absolute -right-3 top-0 text-[8rem] font-black text-[#167347]/[.055]">夢</span><div className="relative max-w-[570px]"><h2 className="text-[22px] font-black leading-tight tracking-[-.025em] sm:text-[28px]">Belajar Bahasa Jepang Jadi Lebih Mudah</h2><p className="mt-3 text-[13px] leading-6 text-slate-600 sm:text-[14px]">Materi lengkap, latihan interaktif, dan simulasi JLPT dalam satu tempat. Dirancang untuk membantu kamu mencapai target langkah demi langkah.</p><div className="mt-5 grid gap-2.5 text-[12px] font-semibold text-slate-700 sm:text-[13px]">{["Materi terstruktur N5–N1","Contoh kalimat & audio","Pantau progres belajar","Akses di mana saja, kapan saja"].map(x => <p key={x} className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-[#167347] text-white"><Check className="size-3" /></span>{x}</p>)}</div></div></div></section>

    <section id="akses" className="bg-[#fffdf9] px-4 pb-11 pt-4 sm:px-6"><div className="mx-auto max-w-[1060px] rounded-[24px] border border-black/[.045] bg-white p-5 sm:p-7"><h2 className="text-[20px] font-black tracking-[-.02em] sm:text-[25px]">Mulai Perjalanan Belajarmu Sekarang</h2><p className="mt-1.5 text-[12px] text-slate-500 sm:text-[13px]">Gratis untuk memulai. Tingkatkan akses saat kamu membutuhkan fitur Premium.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><article className="rounded-[18px] border border-slate-100 bg-[#fbfcfb] p-5"><div className="text-xl">🌱</div><h3 className="mt-2 text-[15px] font-black">Gratis</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">Akses materi dasar dan latihan harian.</p><a href="/auth" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#167347] py-2.5 text-[12px] font-bold text-[#17623f]">Mulai Gratis <ArrowRight className="size-3.5" /></a></article><article className="rounded-[18px] border border-[#f2e4bd] bg-[#fffaf0] p-5"><div className="text-xl">👑</div><h3 className="mt-2 text-[15px] font-black">Premium</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">Akses pembelajaran dan fitur Premium yang lebih lengkap.</p><a href="/auth" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#167347] py-2.5 text-[12px] font-bold text-white">Lihat di Aplikasi <ArrowRight className="size-3.5" /></a></article></div></div></section>

    <footer className="border-t border-[#174b35]/10 bg-[#123b2a] px-5 py-6 text-center text-[10px] text-emerald-50/70">© {new Date().getFullYear()} ENO NIHONGO · Your Japanese Learning Hub</footer>
  </main>;
}
