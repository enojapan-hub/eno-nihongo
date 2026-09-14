import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Brain, Headphones, Languages, Loader2, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const CANONICAL_ORIGIN = "https://www.enonihongo.com";
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
      { property: "og:url", content: `${CANONICAL_ORIGIN}/` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ENO NIHONGO — Belajar Bahasa Jepang & JLPT N5–N1" },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/` }],
  }),
  component: PublicHome,
});

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

const features = [
  { icon: BookOpen, title: "Kanji", text: "Pelajari kanji JLPT secara bertahap dari N5 sampai N1." },
  { icon: Languages, title: "Kosakata", text: "Bangun kosakata bahasa Jepang dengan arti dan contoh penggunaan." },
  { icon: Brain, title: "Bunpou", text: "Pahami pola tata bahasa Jepang beserta penggunaan dan contoh kalimat." },
  { icon: ScrollText, title: "Dokkai", text: "Latih kemampuan membaca melalui bacaan dan soal pemahaman." },
  { icon: Headphones, title: "Choukai", text: "Latih kemampuan menyimak dengan materi dan audio bergaya JLPT." },
];

function PublicHome() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const result = await withTimeout(supabase.auth.getSession(), 2500);
        if (!result.error && result.data.session?.user) {
          const user = result.data.session.user;
          let completed = user.user_metadata?.["onboarding_completed"] === true;
          let role = "student";
          try {
            const profile = await withTimeout(
              supabase.from("profiles").select("onboarding_completed, role").eq("id", user.id).maybeSingle(),
              1800,
            );
            if (!profile.error) {
              completed = profile.data?.onboarding_completed === true;
              role = profile.data?.role ?? "student";
            }
          } catch {
            // Landing page must remain available even when profile lookup fails.
          }
          const destination = role === "owner" || role === "admin" ? "/admin" : completed ? "/dashboard" : "/onboarding";
          window.location.replace(destination);
          return;
        }
      } catch {
        // A failed auth check must never hide the public landing page.
      }
      if (active) setChecking(false);
    }
    void checkSession();
    return () => { active = false; };
  }, []);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${CANONICAL_ORIGIN}/#organization`,
        name: "ENO NIHONGO",
        url: `${CANONICAL_ORIGIN}/`,
      },
      {
        "@type": "WebSite",
        "@id": `${CANONICAL_ORIGIN}/#website`,
        url: `${CANONICAL_ORIGIN}/`,
        name: "ENO NIHONGO",
        inLanguage: "id-ID",
        publisher: { "@id": `${CANONICAL_ORIGIN}/#organization` },
      },
      {
        "@type": "EducationalApplication",
        name: "ENO NIHONGO",
        url: `${CANONICAL_ORIGIN}/`,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        inLanguage: "id-ID",
        description: DESCRIPTION,
        educationalLevel: ["JLPT N5", "JLPT N4", "JLPT N3", "JLPT N2", "JLPT N1"],
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#183126]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="border-b border-[#dfe8e2] bg-white/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <a href="/" className="text-xl font-extrabold tracking-tight text-[#1f6f4a]">ENO NIHONGO</a>
          <a href="/auth" className="rounded-xl bg-[#1f6f4a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#185a3c]">Masuk</a>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1.15fr_.85fr] md:items-center md:py-24">
        <div>
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#1f6f4a]">Belajar Bahasa Jepang • JLPT N5–N1</p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-[#14291f] md:text-6xl">Belajar bahasa Jepang lebih terarah bersama ENO NIHONGO.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[#53665c] md:text-lg">Pelajari Kanji, Kosakata, Bunpou, Dokkai, dan Choukai dari level N5 hingga N1. Uji kemampuan melalui latihan dan simulasi JLPT dalam satu tempat.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/auth" className="inline-flex items-center gap-2 rounded-xl bg-[#1f6f4a] px-5 py-3 font-bold text-white transition hover:bg-[#185a3c]">Mulai belajar <ArrowRight className="size-4" /></a>
            <a href="#materi" className="rounded-xl border border-[#b9cbbf] bg-white px-5 py-3 font-bold text-[#244638]">Lihat materi</a>
          </div>
          {checking && <p className="mt-4 inline-flex items-center gap-2 text-xs text-[#718178]"><Loader2 className="size-3 animate-spin" /> Memeriksa sesi…</p>}
        </div>

        <div className="rounded-3xl border border-[#dce7df] bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-bold text-[#1f6f4a]">Jalur JLPT</p>
          <h2 className="mt-2 text-2xl font-extrabold">N5 → N4 → N3 → N2 → N1</h2>
          <p className="mt-3 leading-7 text-[#607168]">Pilih level yang sedang kamu pelajari dan fokus pada materi yang relevan. Progress belajar, latihan, dan simulasi dirancang agar persiapan ujian lebih terstruktur.</p>
          <div className="mt-6 grid grid-cols-5 gap-2" aria-label="Level JLPT">
            {["N5", "N4", "N3", "N2", "N1"].map((level) => <span key={level} className="rounded-lg bg-[#eef5f0] px-2 py-3 text-center text-sm font-extrabold text-[#1f6f4a]">{level}</span>)}
          </div>
        </div>
      </section>

      <section id="materi" className="border-y border-[#dfe8e2] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#1f6f4a]">Materi belajar</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Lima kemampuan utama untuk persiapan JLPT</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-[#dfe8e2] bg-[#fbfcfb] p-5">
                <Icon className="size-6 text-[#1f6f4a]" aria-hidden />
                <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#607168]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-3xl bg-[#173f2d] px-6 py-10 text-white md:px-10">
          <h2 className="text-3xl font-black">Latihan dan simulasi JLPT dalam satu platform.</h2>
          <p className="mt-3 max-w-2xl leading-7 text-[#d8e8df]">Gunakan materi untuk memahami konsep, latihan untuk memperkuat ingatan, lalu simulasi untuk mengukur kesiapan menghadapi format ujian JLPT.</p>
          <a href="/auth" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-[#173f2d]">Gabung ENO NIHONGO <ArrowRight className="size-4" /></a>
        </div>
      </section>

      <footer className="border-t border-[#dfe8e2] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-[#687970] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} ENO NIHONGO</p>
          <p>Belajar bahasa Jepang • Persiapan JLPT N5–N1</p>
        </div>
      </footer>
    </main>
  );
}
