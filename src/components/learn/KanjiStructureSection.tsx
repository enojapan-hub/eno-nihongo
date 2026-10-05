import { useQuery } from "@tanstack/react-query";
import {
  buildShapeExplanation,
  fetchKanjiStructure,
  hasRadicalConflict,
  nodeGlyph,
  nodeKindLabel,
  radicalBaseNote,
  radicalTitle,
  type KanjiFamilyItem,
  type KanjiStructure,
  type KanjiTreeNode,
} from "@/lib/kanji-structure";
import type { Level } from "@/lib/learn-queries";

type Props = {
  kanjiId: string;
  character: string;
  level: Level;
  /** Membuka detail kanji lain; semua id dari RPC adalah kanji terpublikasi yang boleh dibaca pengguna. */
  onOpen: (id: string) => void;
};

const chipBase =
  "grid size-11 shrink-0 place-items-center rounded-xl border bg-card font-jp text-[22px] font-semibold";
const chipLink =
  "hover:bg-primary/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const ROLE_LABEL = { phonetic: "Petunjuk bunyi", semantic: "Petunjuk makna" } as const;

export function KanjiStructureSection({ kanjiId, character, level, onOpen }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["kanji-structure", kanjiId, level],
    queryFn: () => fetchKanjiStructure(kanjiId, level),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  if (isLoading)
    return (
      <div
        aria-label="Memuat struktur kanji"
        className="mt-4 h-28 animate-pulse rounded-xl bg-muted/60"
      />
    );
  if (error)
    return (
      <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center">
        <p className="text-[11px] text-destructive">Struktur Kanji gagal dimuat.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 min-h-11 rounded-full border px-4 text-[11px] font-semibold"
        >
          Coba Lagi
        </button>
      </div>
    );
  if (!data)
    return (
      <section className="mt-4">
        <h3 className="text-[16px] font-bold">Struktur Kanji</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">Struktur kanji ini belum tersedia.</p>
      </section>
    );
  return <Loaded s={data} character={character} onOpen={onOpen} />;
}

function NodeRow({ n, onOpen }: { n: KanjiTreeNode; onOpen: (id: string) => void }) {
  const glyph = nodeGlyph(n);
  return (
    <div className="flex min-w-0 items-start gap-2">
      {n.kanjiId ? (
        <button
          type="button"
          lang="ja"
          aria-label={`Buka kanji ${n.element}`}
          onClick={() => onOpen(n.kanjiId!)}
          className={`${chipBase} ${chipLink}`}
        >
          {glyph}
        </button>
      ) : (
        <span lang="ja" className={`${chipBase} text-muted-foreground`}>
          {glyph}
        </span>
      )}
      <div className="min-w-0 flex-1 pt-0.5 text-[13px] leading-5">
        <p className="text-muted-foreground">{nodeKindLabel(n)}</p>
        {n.meaningId && <p className="font-medium">{n.meaningId}</p>}
        {n.baseForm && n.baseKanjiId && (
          <button
            type="button"
            lang="ja"
            aria-label={`Buka kanji ${n.baseForm}`}
            onClick={() => onOpen(n.baseKanjiId!)}
            className="min-h-6 rounded text-[12px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Lihat {n.baseForm}
          </button>
        )}
        {n.role && (
          <span className="mt-0.5 inline-block rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {ROLE_LABEL[n.role]}
          </span>
        )}
      </div>
    </div>
  );
}

function TreeList({
  nodes,
  onOpen,
  nested,
}: {
  nodes: readonly KanjiTreeNode[];
  onOpen: (id: string) => void;
  nested?: boolean;
}) {
  return (
    <ul className={nested ? "ml-5 mt-1.5 space-y-1.5 border-l pl-3" : "space-y-2"}>
      {nodes.map((n) => (
        <li key={n.id} className="min-w-0">
          <NodeRow n={n} onOpen={onOpen} />
          {n.children.length > 0 && <TreeList nodes={n.children} onOpen={onOpen} nested />}
        </li>
      ))}
    </ul>
  );
}

function FamilyGrid({
  items,
  onOpen,
  labelId,
}: {
  items: readonly KanjiFamilyItem[];
  onOpen: (id: string) => void;
  labelId: string;
}) {
  return (
    <ul aria-labelledby={labelId} className="mt-2 grid grid-cols-3 gap-1.5 min-[420px]:grid-cols-4">
      {items.map((f) => (
        <li key={f.id} className="min-w-0">
          <button
            type="button"
            aria-label={`Buka kanji ${f.character}`}
            onClick={() => onOpen(f.id)}
            className={`flex min-h-[76px] w-full min-w-0 flex-col items-center rounded-2xl border bg-card px-1 py-2 text-center shadow-sm ${chipLink}`}
          >
            <span lang="ja" className="font-jp text-[24px] font-semibold leading-8">
              {f.character}
            </span>
            <span lang="ja" className="line-clamp-1 font-jp text-[12px] text-muted-foreground">
              {f.reading ?? "—"}
            </span>
            <span className="line-clamp-1 text-[12px] leading-4 text-muted-foreground">
              {f.meaningId ?? "—"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Loaded({
  s,
  character,
  onOpen,
}: {
  s: KanjiStructure;
  character: string;
  onOpen: (id: string) => void;
}) {
  const r = s.radical;
  const baseNote = radicalBaseNote(r);
  const conflict = hasRadicalConflict(r);
  const explanation = buildShapeExplanation(character, s);
  return (
    <>
      <section className="mt-4" aria-labelledby="kanji-struktur">
        <h3 id="kanji-struktur" className="text-[16px] font-bold">
          Struktur Kanji
        </h3>
        <div className="mt-2 rounded-xl bg-primary/[.07] p-3">
          <p className="text-[12px] text-muted-foreground">
            {conflict ? "Bushu (menurut KanjiVG)" : "Bushu"}
          </p>
          <p lang="ja" className="mt-1 break-words font-jp text-[18px] font-semibold leading-6">
            {radicalTitle(r)}
          </p>
          {baseNote && <p className="text-[12px] text-muted-foreground">{baseNote}</p>}
          <p className="mt-1 text-[14px] leading-5">Arti: {r.meaningId}</p>
          {conflict && r.kd2 && (
            <div className="mt-2 border-t pt-2">
              <p className="text-[12px] text-muted-foreground">
                Bushu klasik Kangxi (menurut KANJIDIC2)
              </p>
              <p lang="ja" className="mt-1 font-jp text-[18px] font-semibold leading-6">
                {r.kd2.base}
                {r.kd2.nameJa ? `（${r.kd2.nameJa}）` : ""}
              </p>
              {r.kd2.meaningId && <p className="text-[14px] leading-5">Arti: {r.kd2.meaningId}</p>}
            </div>
          )}
          {r.status === "single_source" && (
            <p className="mt-1 text-[12px] text-muted-foreground">Sumber bushu: KANJIDIC2</p>
          )}
        </div>
        <div className="mt-1.5 rounded-xl bg-primary/[.07] p-3">
          <p className="text-[12px] text-muted-foreground">Komponen</p>
          {s.tree.length === 0 ? (
            <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
              {s.needsReview
                ? "Rincian komponen sedang ditinjau."
                : "Bentuk dasar; tidak diuraikan lebih lanjut."}
            </p>
          ) : (
            <div className="mt-2">
              <TreeList nodes={s.tree} onOpen={onOpen} />
            </div>
          )}
        </div>
      </section>
      <section className="mt-4" aria-labelledby="kanji-bentuk">
        <h3 id="kanji-bentuk" className="text-[16px] font-bold">
          Memahami Bentuk Kanji
        </h3>
        <div className="mt-2 space-y-1.5 rounded-lg bg-muted/35 p-2.5 text-[14px] leading-6">
          {explanation.map((line, i) => (
            <p key={i} className="break-words [overflow-wrap:anywhere]">
              {line}
            </p>
          ))}
        </div>
      </section>
      {s.mnemonic && (
        <section className="mt-4" aria-labelledby="kanji-mnemonic">
          <h3 id="kanji-mnemonic" className="text-[16px] font-bold">
            Cara Mudah Mengingat
          </h3>
          <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/[.07] p-2.5">
            <p className="text-[14px] leading-6">{s.mnemonic}</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Ini hanya alat bantu ingatan, bukan asal-usul kanji.
            </p>
          </div>
        </section>
      )}
      {s.family.length > 0 && (
        <section className="mt-4" aria-labelledby="kanji-keluarga">
          <h3 id="kanji-keluarga" className="text-[16px] font-bold">
            Kanji dengan Bushu yang Sama
          </h3>
          <FamilyGrid items={s.family} onOpen={onOpen} labelId="kanji-keluarga" />
          {s.familyTotal > s.family.length && (
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Menampilkan {s.family.length} dari {s.familyTotal} kanji dengan bushu ini.
            </p>
          )}
        </section>
      )}
      {s.phoneticElement && s.phoneticFamily.length > 0 && (
        <section className="mt-4" aria-labelledby="kanji-bunyi">
          <h3 id="kanji-bunyi" className="text-[16px] font-bold">
            Kanji dengan Petunjuk Bunyi <span lang="ja">「{s.phoneticElement}」</span> yang Sama
          </h3>
          <FamilyGrid items={s.phoneticFamily} onOpen={onOpen} labelId="kanji-bunyi" />
        </section>
      )}
      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        Data struktur: KanjiVG (CC BY-SA 3.0), KANJIDIC2 © EDRDG (dipakai sesuai lisensi
        edrdg.org/edrdg/licence.html), dan Kanji alive (CC BY 4.0).
      </p>
    </>
  );
}
