import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Brain, Check, Headphones, Languages, Menu, ScrollText, Sparkles, Trophy } from "lucide-react";
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
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${ORIGIN}/` }],
  }),
  component: Home,
});

const features = [
  { icon: "漢", title: "Kanji", text: "Dari dasar hingga N1", tone: "bg-emerald-50 text-emerald-700" },
  { icon: BookOpen, title: "Kosakata", text: "Kata & contoh penggunaan", tone: "bg-sky-50 text-sky-600" },
  { icon: Languages, title: "Bunpou", text: "Penjelasan mudah dipahami", tone: "bg-rose-50 text-rose-600" },
  { icon: Headphones, title: "Choukai", text: "Latihan audio JLPT", tone: "bg-violet-50 text-violet-600" },
  { icon: ScrollText, title: "Dokkai", text: "Tingkatkan kemampuan baca", tone: "bg-amber-50 text-amber-600" },
  { icon: Trophy, title: "Simulasi JLPT", text: "Latihan seperti ujian", tone: "bg-emerald-50 text-emerald-700" },
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
        if (role === "owner" || role === "admin") window.location.replace("/admin");
        else window.location.replace(profile?.onboarding_completed ? "/dashboard" : "/onboarding");
      } catch { /* public homepage remains usable */ }
    })();
  }, []);

  const jsonLd = { "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": `${ORIGIN}/#organization`, name: "ENO NIHONGO", url: `${ORIGIN}/` },
    { "@type": "WebSite", "@id": `${ORIGIN}/#website`, name: "ENO NIHONGO", url: `${ORIGIN}/`, inLanguage: "id-ID" },
    { "@type": "EducationalApplication", name: "ENO NIHONGO", url: `${ORIGIN}/`, applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: "id-ID", description: DESCRIPTION, educationalLevel: ["JLPT N5","JLPT N4","JLPT N3","JLPT N2","JLPT N1"] },
  ]};

  return <main className="min-h-screen overflow-hidden bg-[#f8fbf8] text-slate-950">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

    <header className="sticky top-0 z-50 border-b border-emerald-900/5 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5"><img src="/enonihongo-logo.svg" alt="" className="h-9 w-9"/><div><div className="font-black tracking-tight text-emerald-800">ENO NIHONGO</div><div className="hidden text-[10px] text-slate-500 sm:block">Your Japanese Learning Hub</div></div></a>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex"><a href="#fitur">Fitur</a><a href="#materi">Materi</a><a href="#jalur">JLPT</a><a href="#akses">Akses</a></nav>
        <div className="flex items-center gap-2"><a href="/auth" className="hidden rounded-full border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 sm:block">Masuk</a><a href="/auth" className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-800">Mulai Gratis</a><button aria-label="Menu" className="grid size-10 place-items-center rounded-full border border-slate-200 md:hidden"><Menu className="size-5"/></button></div>
      </div>
    </header>

    <section className="relative isolate overflow-hidden border-b border-emerald-900/5">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_75%_25%,#dff4e7_0,transparent_38%),radial-gradient(circle_at_20%_10%,#e7f3ff_0,transparent_32%),linear-gradient(180deg,#f9fcff_0%,#f4faf5_100%)]" />
      <div className="absolute -right-20 top-10 -z-10 size-72 rounded-full bg-pink-100/40 blur-3xl" />
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-10 sm:px-6 md:grid-cols-[1.05fr_.95fr] md:pb-20 md:pt-16">
        <div className="order-2 md:order-1">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-extrabold tracking-[.15em] text-emerald-700"><Sparkles className="size-3.5"/> BELAJAR • LATIH • CAPAI • JLPT</div>
          <h1 className="max-w-3xl text-[2.6rem] font-black leading-[1.04] tracking-[-.04em] sm:text-5xl lg:text-6xl">Wujudkan kemampuan bahasa Jepang <span className="text-emerald-700">versi terbaikmu.</span></h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">ENO NIHONGO membantu kamu belajar bahasa Jepang dan mempersiapkan JLPT N5–N1 dengan materi yang terarah, latihan interaktif, dan simulasi dalam satu tempat.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row"><a href="/auth" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 py-3.5 font-extrabold text-white shadow-lg shadow-emerald-900/10 hover:bg-emerald-800">Mulai Belajar Gratis <ArrowRight className="size-4"/></a><a href="#fitur" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-700/30 bg-white/80 px-6 py-3.5 font-extrabold text-emerald-800">Lihat Fitur <ArrowRight className="size-4"/></a></div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600"><span className="flex items-center gap-1.5"><Check className="size-4 text-emerald-600"/> Bahasa Indonesia</span><span className="flex items-center gap-1.5"><Check className="size-4 text-emerald-600"/> N5 sampai N1</span><span className="flex items-center gap-1.5"><Check className="size-4 text-emerald-600"/> Mulai gratis</span></div>
        </div>

        <div className="order-1 relative mx-auto flex w-full max-w-[520px] items-center justify-center md:order-2">
          <div className="absolute inset-x-10 bottom-2 h-20 rounded-[50%] bg-emerald-900/10 blur-2xl"/>
          <div className="absolute right-0 top-2 rounded-2xl border border-white/70 bg-white/85 px-4 py-3 text-center shadow-xl backdrop-blur sm:right-4"><p className="font-black text-slate-800">一緒に頑張ろう!</p><p className="text-xs font-semibold text-emerald-700">Ayo belajar bersama!</p></div>
          <img src={MASCOT} alt="Maskot ENO NIHONGO memakai kimono dan membawa kuas" className="relative z-10 w-[78%] max-w-[390px] drop-shadow-[0_25px_25px_rgba(20,70,45,.16)] sm:w-[72%]" />
        </div>
      </div>
    </section>

    <section id="fitur" className="relative z-10 mx-auto -mt-3 max-w-7xl px-4 sm:px-6">
      <div className="grid grid-cols-2 gap-3 rounded-3xl border border-slate-200/70 bg-white p-3 shadow-xl shadow-slate-900/5 sm:grid-cols-3 lg:grid-cols-6">
        {features.map((f) => { const I = f.icon; return <article key={f.title} className="rounded-2xl p-3 text-center transition hover:bg-slate-50 sm:p-4"><div className={`mx-auto grid size-12 place-items-center rounded-2xl ${f.tone}`}>{typeof I === "string" ? <span className="text-2xl font-black">{I}</span> : <I className="size-6"/>}</div><h2 className="mt-3 text-sm font-extrabold">{f.title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{f.text}</p></article> })}
      </div>
    </section>

    <section id="materi" className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-16">
      <div className="relative overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-7 sm:p-9"><span className="absolute -right-4 top-6 text-[9rem] font-black text-emerald-700/[.05]">夢</span><p className="text-xs font-black tracking-[.16em] text-emerald-700">BELAJAR LEBIH TERARAH</p><h2 className="mt-2 max-w-md text-3xl font-black tracking-tight">Materi Jepang yang rapi, dari dasar sampai mahir.</h2><p className="mt-4 max-w-lg leading-7 text-slate-600">Satu alur belajar untuk Kanji, Kosakata, Bunpou, Dokkai, dan Choukai. Fokus pada levelmu tanpa tenggelam dalam materi yang tidak relevan.</p><div className="mt-6 space-y-3">{["Materi terstruktur N5–N1","Contoh kalimat dan penggunaan","Audio dan latihan pemahaman","Progress belajar yang mudah dipantau"].map(x=><p key={x} className="flex items-center gap-3 font-semibold text-slate-700"><span className="grid size-6 place-items-center rounded-full bg-emerald-700 text-white"><Check className="size-3.5"/></span>{x}</p>)}</div></div>
      <div id="jalur" className="rounded-[2rem] bg-[#153f2d] p-7 text-white sm:p-9"><p className="text-xs font-black tracking-[.16em] text-emerald-200">JALUR JLPT</p><h2 className="mt-2 text-3xl font-black tracking-tight">Naik level dengan tujuan yang jelas.</h2><p className="mt-4 leading-7 text-emerald-50/80">Mulai dari level yang sesuai kemampuanmu. Gunakan materi untuk memahami, latihan untuk mengingat, lalu simulasi untuk mengukur kesiapan ujian.</p><div className="mt-7 grid grid-cols-5 gap-2">{["N5","N4","N3","N2","N1"].map((x,i)=><div key={x} className="rounded-2xl border border-white/10 bg-white/10 px-1 py-4 text-center"><div className="text-lg font-black">{x}</div><div className="mt-1 text-[9px] uppercase tracking-wide text-emerald-100/70">Level {i+1}</div></div>)}</div><a href="/auth" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-extrabold text-emerald-900">Mulai dari levelmu <ArrowRight className="size-4"/></a></div>
    </section>

    <section id="akses" className="border-y border-emerald-900/5 bg-white py-12 lg:py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6"><div className="text-center"><p className="text-xs font-black tracking-[.16em] text-emerald-700">MULAI SEKARANG</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Belajar dulu. Tingkatkan akses saat kamu membutuhkannya.</h2><p className="mx-auto mt-3 max-w-2xl text-slate-600">Akses gratis tersedia untuk memulai. Fitur Premium membuka pengalaman belajar yang lebih lengkap.</p></div><div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2"><div className="rounded-3xl border border-slate-200 p-6"><div className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-2xl">🌱</div><h3 className="mt-4 text-xl font-black">Gratis</h3><p className="mt-2 text-sm leading-6 text-slate-600">Mulai belajar dan coba fitur dasar ENO NIHONGO.</p><a href="/auth" className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-emerald-700 py-3 font-extrabold text-emerald-800">Mulai Gratis <ArrowRight className="size-4"/></a></div><div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-6"><div className="grid size-11 place-items-center rounded-2xl bg-amber-100 text-2xl">👑</div><h3 className="mt-4 text-xl font-black">Premium</h3><p className="mt-2 text-sm leading-6 text-slate-600">Akses pembelajaran dan fitur Premium yang lebih lengkap.</p><a href="/auth" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 font-extrabold text-white">Lihat di aplikasi <ArrowRight className="size-4"/></a></div></div></div></section>

    <footer className="bg-[#0f3022] text-emerald-50"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex items-center gap-3"><img src="/enonihongo-logo.svg" alt="" className="h-10 w-10 brightness-0 invert"/><div><div className="font-black">ENO NIHONGO</div><div className="text-xs text-emerald-100/60">Your Japanese Learning Hub</div></div></div><p className="text-sm text-emerald-100/60">© {new Date().getFullYear()} ENO NIHONGO · Belajar Jepang · JLPT N5–N1</p></div></footer>
  </main>;
}
