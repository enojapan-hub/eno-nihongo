import { CircleHelp } from "lucide-react";

/** Panduan ringkas bushu & komponen untuk pemula; native <details> agar ringan dan aksesibel. */
export function KanjiGuide() {
  return (
    <details className="group mb-3 rounded-xl border bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        <CircleHelp aria-hidden className="size-4 text-primary" />
        Panduan Kanji
      </summary>
      <div className="space-y-2.5 border-t px-3 py-3 text-[13px] leading-5">
        <div>
          <p className="font-bold">Apa itu Bushu?</p>
          <p className="text-muted-foreground">
            Bushu (部首) adalah bagian utama yang dipakai untuk mengelompokkan kanji di kamus.
          </p>
        </div>
        <div>
          <p className="font-bold">Apa itu Komponen?</p>
          <p className="text-muted-foreground">
            Komponen adalah bagian-bagian yang menyusun bentuk sebuah kanji. Satu kanji bisa punya
            beberapa komponen, dan sebuah komponen bisa tersusun dari bagian yang lebih kecil.
          </p>
        </div>
        <div lang="ja" className="rounded-lg bg-muted/35 p-2.5">
          <p className="font-jp text-[15px] font-semibold">語 → 言 + 吾</p>
          <p className="font-jp text-[13px] text-muted-foreground">
            Bushu 語 adalah 言（ごんべん）. 吾 adalah komponen lain, yang tersusun dari 五 + 口.
          </p>
        </div>
        <div>
          <p className="font-bold">Petunjuk bunyi</p>
          <p className="text-muted-foreground">
            Pada banyak kanji, satu bagian menunjukkan bunyi. Bagian itu hanya ditandai bila memang
            ada penandanya; selain itu ditulis netral sebagai komponen penyusun.
          </p>
        </div>
        <div>
          <p className="font-bold">Cara Mudah Mengingat</p>
          <p className="text-muted-foreground">
            Cerita pendek pembantu ingatan. Ini bukan asal-usul kanji dan bisa berbeda dari
            sejarahnya.
          </p>
        </div>
      </div>
    </details>
  );
}
