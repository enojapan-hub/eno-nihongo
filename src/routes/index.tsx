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
      } catch { /* public homepage stays available */ }
    })();
  }, []);

  const jsonLd = { "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": `${ORIGIN}/#organization`, name: "ENO NIHONGO", url: `${ORIGIN}/` },
    { "@type": "WebSite", "@id": `${ORIGIN}/#website`, name: "ENO NIHONGO", url: `${ORIGIN}/`, inLanguage: "id-ID" },
    { "@type": "EducationalApplication", name: "ENO NIHONGO", url: `${ORIGIN}/`, applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: "id-ID", description: DESCRIPTION },
  ]};

  return <main className="min-h-screen bg-[#f7faf8] font-sans text-slate-950">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex min-w-0 items-center gap-2.5">
          <img src="/enonihongo-logo-light.png" alt="Logo ENO NIHONGO" className="size-10 shrink-0 rounded-xl object-contain" />
          <div className="min-w-0 leading-none"><div className="truncate text-[17px] font-extrabold tracking-[-.02em] text-emerald-800 sm:text-xl">ENO NIHONGO</div><div className="mt-1 hidden text-[10px] font-medium text-slate-500 sm:block">Your Japanese Learning Hub</div></div>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex"><a href="#fitur">Fitur</a><a href="#materi">Materi</a><a href="#akses">Akses</a></nav>
        <div className="flex items-center gap-2"><a href="/auth" className="rounded-full bg-emerald-700 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm sm:px-5 sm:text-sm">Mulai Gratis</a><button aria-label="Menu" className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white md:hidden"><Menu className="size-5" /></button></div>
      </div>
    </header>

    <section className="relative overflow-hidden border-b border-emerald-900/5 bg-[linear-gradient(180deg,#eff9ff_0%,#f6fbf7_60%,#fff_100%)]">
      <div className="pointer-events-none absolute -left-20 top-8 size-64 rounded-full bg-sky-200/25 blur-3xl" /><div className="pointer-events-none absolute -right-20 top-16 size-72 rounded-full bg-pink-200/25 blur-3xl" />
      <div className="mx-auto grid max-w-6xl items-center gap-5 px-5 pb-9 pt-8 sm:px-6 md:grid-cols-[1.05fr_.95fr] md:gap-8 md:pb-14 md:pt-12">
        <div className="order-2 md:order-1">
          <p className="text-[11px] font-extrabold tracking-[.19em] text-emerald-700 sm:text-xs">BELAJAR · LATIH · CAPAI · JLPT</p>
          <h1 className="mt-3 max-w-[620px] text-[36px] font-black leading-[1.02] tracking-[-.045em] sm:text-[46px] lg:text-[54px]">Wujudkan Kemampuan Bahasa Jepang <span className="text-emerald-700">Versi Terbaikmu</span></h1>
          <p className="mt-4 max-w-[570px] text-[14px] leading-[1.55] text-slate-600 sm:text-[16px]">ENO NIHONGO adalah platform belajar bahasa Jepang untuk persiapan JLPT N5–N1. Belajar lebih terarah, praktis, dan menyenangkan.</p>
          <div className="mt-5 grid gap-2.5 sm:max-w-[520px]"><a href="/auth" className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-900/10">Mulai Belajar Gratis <ArrowRight className="size-4" /></a><a href="#fitur" className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-700/35 bg-white/80 px-5 py-3 text-sm font-extrabold text-emerald-800">Lihat Fitur <ArrowRight className="size-4" /></a></div>
        </div>
        <div className="order-1 relative mx-auto h-[275px] w-full max-w-[420px] md:order-2 md:h-[410px]">
          <div className="absolute right-0 top-0 z-20 rounded-2xl bg-white/90 px-3 py-2 text-center shadow-lg"><p className="text-sm font-black">一緒に頑張ろう!</p><p className="text-[10px] font-semibold text-emerald-700">Ayo belajar bersama!</p></div>
          <div className="absolute bottom-4 left-1/2 h-12 w-64 -translate-x-1/2 rounded-[50%] bg-emerald-900/10 blur-xl" />
          <img src={MASCOT} alt="Maskot ENO NIHONGO" className="absolute bottom-0 left-1/2 z-10 h-[260px] w-auto -translate-x-1/2 object-contain drop-shadow-[0_18px_18px_rgba(15,70,45,.15)] md:h-[395px]" />
        </div>
      </div>
    </section>

    <section id="fitur" className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <div className="grid grid-cols-3 gap-2 rounded-3xl border border-slate-100 bg-white p-3 shadow-sm md:grid-cols-6 md:gap-3 md:p-5">{features.map((f) => { const Icon = f.icon; return <article key={f.title} className="px-1 py-2 text-center"><div className={`mx-auto grid size-11 place-items-center rounded-2xl ${f.box}`}>{typeof Icon === "string" ? <span className="text-xl font-black">{Icon}</span> : <Icon className="size-5" />}</div><h2 className="mt-2 text-[12px] font-extrabold sm:text-sm">{f.title}</h2><p className="mt-1 hidden text-[10px] leading-4 text-slate-500 sm:block">{f.text}</p></article> })}</div>
    </section>

    <section id="materi" className="mx-auto max-w-6xl px-4 py-4 sm:px-6"><div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-6 sm:p-8"><span className="absolute -right-3 top-2 text-[8rem] font-black text-emerald-700/[.06]">夢</span><h2 className="max-w-lg text-2xl font-black leading-tight tracking-[-.025em] sm:text-3xl">Belajar Bahasa Jepang Jadi Lebih Mudah</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-[15px]">Materi lengkap, latihan interaktif, dan simulasi JLPT dalam satu tempat. Dirancang untuk membantu kamu mencapai target langkah demi langkah.</p><div className="mt-5 grid gap-2 text-sm font-semibold text-slate-700">{["Materi terstruktur N5–N1","Contoh kalimat & audio","Pantau progres belajar","Akses di mana saja, kapan saja"].map(x => <p key={x} className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-emerald-700 text-white"><Check className="size-3" /></span>{x}</p>)}</div></div></section>

    <section id="akses" className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6"><div className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-7"><h2 className="text-xl font-black tracking-tight sm:text-2xl">Mulai Perjalanan Belajarmu Sekarang</h2><p className="mt-1 text-sm text-slate-500">Gratis untuk memulai. Tingkatkan akses saat kamu membutuhkan fitur Premium.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><article className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5"><div className="text-2xl">🌱</div><h3 className="mt-2 font-black">Gratis</h3><p className="mt-1 text-xs leading-5 text-slate-500">Akses materi dasar dan latihan harian.</p><a href="/auth" className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-700 py-2.5 text-sm font-bold text-emerald-800">Mulai Gratis <ArrowRight className="size-4" /></a></article><article className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5"><div className="text-2xl">👑</div><h3 className="mt-2 font-black">Premium</h3><p className="mt-1 text-xs leading-5 text-slate-500">Akses pembelajaran dan fitur Premium yang lebih lengkap.</p><a href="/auth" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white">Lihat di Aplikasi <ArrowRight className="size-4" /></a></article></div><div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-slate-100 pt-5 text-xs font-semibold text-slate-500"><span>🇮🇩 Bahasa Indonesia</span><span>🇯🇵 JLPT N5–N1</span><span>📱 Mobile friendly</span></div></div></section>

    <footer className="border-t border-emerald-900/10 bg-[#103426] px-5 py-7 text-center text-xs text-emerald-50/70">© {new Date().getFullYear()} ENO NIHONGO · Your Japanese Learning Hub</footer>
  </main>;
}
