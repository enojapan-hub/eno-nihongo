import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  buildShapeExplanation,
  componentState,
  fetchKanjiStructure,
  hasRadicalConflict,
  nodeBadges,
  nodeCaption,
  nodeGlyph,
  primaryMeaning,
  radicalBaseNote,
  radicalTitle,
  splitFamily,
  type KanjiFamilyItem,
  type KanjiStructure,
  type KanjiTreeNode,
} from "@/lib/kanji-structure";
import type { Level } from "@/lib/learn-queries";

type Props = {
  kanjiId: string;
  character: string;
  /** Arti kanji ini (untuk kalimat penjelasan kanji dasar). */
  meaning?: string | null;
  level: Level;
  /** Membuka detail kanji lain; semua id dari RPC adalah kanji terpublikasi yang boleh dibaca pengguna. */
  onOpen: (id: string) => void;
};

const chipLink =
  "hover:bg-primary/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function KanjiStructureSection({ kanjiId, character, meaning, level, onOpen }: Props) {
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
  if (!data) return null;
  return <Loaded s={data} character={character} meaning={meaning ?? null} onOpen={onOpen} />;
}

/** Satu bagian kanji: karakter (tombol bila kanji mandiri), arti utama, dan lencana singkat. */
function Cell({
  n,
  radicalForm,
  onOpen,
  small,
}: {
  n: KanjiTreeNode;
  radicalForm: string;
  onOpen: (id: string) => void;
  small?: boolean | undefined;
}) {
  const caption = nodeCaption(n);
  const badges = nodeBadges(n, radicalForm);
  const size = small ? "size-10 text-[20px]" : "size-12 text-[26px]";
  const chip = `grid ${size} shrink-0 place-items-center rounded-xl border bg-card font-jp font-semibold`;
  return (
    <div className="flex w-[76px] min-w-0 flex-col items-center text-center">
      {n.kanjiId ? (
        <button
          type="button"
          lang="ja"
          aria-label={`Buka kanji ${n.element}`}
          onClick={() => onOpen(n.kanjiId!)}
          className={`${chip} ${chipLink}`}
        >
          {nodeGlyph(n)}
        </button>
      ) : (
        <span lang="ja" className={`${chip} text-muted-foreground`}>
          {nodeGlyph(n)}
        </span>
      )}
      {caption && (
        <span className="mt-1 line-clamp-2 text-[12px] leading-4 text-muted-foreground">
          {caption}
        </span>
      )}
      {n.baseForm && (
        <span lang="ja" className="text-[11px] leading-4 text-muted-foreground">
          Bentuk dasar: {n.baseForm}
        </span>
      )}
      {badges.length > 0 && (
        <span className="mt-1 flex flex-wrap justify-center gap-1">
          {badges.map((b) => (
            <span
              key={b}
              className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary"
            >
              {b}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function CellRow({
  nodes,
  radicalForm,
  onOpen,
  small,
}: {
  nodes: readonly KanjiTreeNode[];
  radicalForm: string;
  onOpen: (id: string) => void;
  small?: boolean | undefined;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-1 gap-y-3">
      {nodes.map((n, i) => (
        <Fragment key={n.id}>
          {i > 0 && (
            <span aria-hidden className={`${small ? "mt-2" : "mt-3"} text-muted-foreground`}>
              +
            </span>
          )}
          <Cell n={n} radicalForm={radicalForm} onOpen={onOpen} small={small} />
        </Fragment>
      ))}
    </div>
  );
}

/** Baris penguraian bertingkat: "吾 → 五 + 口", menjorok sesuai kedalaman; mudah dibaca di layar sempit. */
function ExpansionRows({
  nodes,
  radicalForm,
  onOpen,
  depth,
}: {
  nodes: readonly KanjiTreeNode[];
  radicalForm: string;
  onOpen: (id: string) => void;
  depth: number;
}) {
  return (
    <>
      {nodes
        .filter((n) => n.children.length > 0)
        .map((n) => (
          <Fragment key={n.id}>
            <div
              style={{ marginLeft: depth * 14 }}
              className="mt-3 flex items-start gap-1.5 border-l-2 border-primary/25 pl-2.5"
            >
              <div
                lang="ja"
                className="grid size-10 shrink-0 place-items-center font-jp text-[22px] font-semibold"
              >
                {nodeGlyph(n)}
              </div>
              <span aria-hidden className="mt-2 text-muted-foreground">
                →
              </span>
              <CellRow nodes={n.children} radicalForm={radicalForm} onOpen={onOpen} small />
            </div>
            <ExpansionRows
              nodes={n.children}
              radicalForm={radicalForm}
              onOpen={onOpen}
              depth={depth + 1}
            />
          </Fragment>
        ))}
    </>
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
  const [open, setOpen] = useState(false);
  const { shown, hidden } = splitFamily(items);
  const visible = open ? items : shown;
  return (
    <>
      <ul
        aria-labelledby={labelId}
        className="mt-2 grid grid-cols-3 gap-1.5 min-[420px]:grid-cols-4 min-[1000px]:grid-cols-6"
      >
        {visible.map((f) => (
          <li key={f.id} className="min-w-0">
            <button
              type="button"
              aria-label={`Buka kanji ${f.character}`}
              onClick={() => onOpen(f.id)}
              className={`flex min-h-[72px] w-full min-w-0 flex-col items-center rounded-2xl border bg-card px-1 py-1.5 text-center shadow-sm ${chipLink}`}
            >
              <span lang="ja" className="font-jp text-[22px] font-semibold leading-7">
                {f.character}
              </span>
              <span lang="ja" className="line-clamp-1 font-jp text-[11px] text-muted-foreground">
                {f.reading ?? "—"}
              </span>
              <span className="line-clamp-1 w-full px-0.5 text-[11px] leading-4 text-muted-foreground">
                {primaryMeaning(f.meaningId) ?? "—"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {hidden.length > 0 && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mt-2 min-h-11 w-full rounded-full border text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {open ? "Tampilkan lebih sedikit" : `Lihat semua (${items.length})`}
        </button>
      )}
    </>
  );
}

function Loaded({
  s,
  character,
  meaning,
  onOpen,
}: {
  s: KanjiStructure;
  character: string;
  meaning: string | null;
  onOpen: (id: string) => void;
}) {
  const r = s.radical;
  const state = componentState(s);
  const conflict = hasRadicalConflict(r);
  const baseNote = radicalBaseNote(r);
  const explanation = buildShapeExplanation(character, s, meaning);
  return (
    <>
      <section className="mt-4" aria-labelledby="kanji-struktur">
        <h3 id="kanji-struktur" className="text-[16px] font-bold">
          Struktur Kanji
        </h3>
        {state === "decomposed" && (
          <div className="mt-2 rounded-xl bg-primary/[.07] p-3">
            <CellRow nodes={s.tree} radicalForm={r.form} onOpen={onOpen} />
            <ExpansionRows nodes={s.tree} radicalForm={r.form} onOpen={onOpen} depth={0} />
          </div>
        )}
        {state === "review" && (
          <p className="mt-2 rounded-xl bg-muted/40 p-3 text-[13px] leading-5 text-muted-foreground">
            Struktur kanji ini masih ditinjau.
          </p>
        )}
        <div className="mt-1.5 rounded-xl bg-primary/[.07] p-3">
          <p className="text-[12px] text-muted-foreground">Bushu</p>
          <p lang="ja" className="mt-0.5 break-words font-jp text-[17px] font-semibold leading-6">
            {radicalTitle(r)}
          </p>
          <p className="text-[13px] leading-5">
            {baseNote ? <span lang="ja">{baseNote} · </span> : null}arti: {r.meaningId}
          </p>
          {conflict && r.kd2 && (
            <p className="mt-1.5 border-t pt-1.5 text-[13px] leading-5 text-muted-foreground">
              Penggolongan klasik Kangxi:{" "}
              <span lang="ja" className="font-jp font-semibold text-foreground">
                {r.kd2.base}
                {r.kd2.nameJa ? `（${r.kd2.nameJa}）` : ""}
              </span>
              {r.kd2.meaningId ? `, arti: ${r.kd2.meaningId}` : ""}
            </p>
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
              Ini adalah cara mengingat, bukan penjelasan asal-usul kanji.
            </p>
          </div>
        </section>
      )}
      {s.family.length > 0 && (
        <section className="mt-4" aria-labelledby="kanji-keluarga">
          <h3 id="kanji-keluarga" className="text-[16px] font-bold">
            Keluarga Bushu
          </h3>
          <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
            Kanji lain yang bushunya sama (<span lang="ja">{r.base}</span>,{" "}
            {primaryMeaning(r.meaningId) ?? r.meaningId}). Mereka bukan bagian penyusun kanji ini.
          </p>
          <FamilyGrid items={s.family} onOpen={onOpen} labelId="kanji-keluarga" />
        </section>
      )}
      {s.phoneticElement && s.phoneticFamily.length > 0 && (
        <section className="mt-4" aria-labelledby="kanji-bunyi">
          <h3 id="kanji-bunyi" className="text-[16px] font-bold">
            Satu Petunjuk Bunyi <span lang="ja">「{s.phoneticElement}」</span>
          </h3>
          <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
            Kanji lain yang memakai komponen bunyi yang sama.
          </p>
          <FamilyGrid items={s.phoneticFamily} onOpen={onOpen} labelId="kanji-bunyi" />
        </section>
      )}
    </>
  );
}
