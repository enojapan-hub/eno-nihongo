import { useQuery } from "@tanstack/react-query";
import {
  buildShapeExplanation,
  fetchKanjiStructure,
  radicalBaseNote,
  radicalTitle,
  type KanjiStructure,
} from "@/lib/kanji-structure";
import type { Level } from "@/lib/learn-queries";

type Props = {
  kanjiId: string;
  character: string;
  level: Level;
  /** Id kanji yang bisa dibuka dari daftar saat ini; selain itu ditampilkan tanpa tautan. */
  openableIds: ReadonlySet<string>;
  onOpen: (id: string) => void;
};

const chipBase =
  "grid min-h-11 min-w-11 place-items-center rounded-xl border bg-card px-2 font-jp text-[22px] font-semibold";
const chipLink =
  "hover:bg-primary/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function KanjiStructureSection({ kanjiId, character, level, openableIds, onOpen }: Props) {
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
  return <Loaded s={data} character={character} openableIds={openableIds} onOpen={onOpen} />;
}

function Loaded({
  s,
  character,
  openableIds,
  onOpen,
}: {
  s: KanjiStructure;
  character: string;
  openableIds: ReadonlySet<string>;
  onOpen: (id: string) => void;
}) {
  const r = s.radical;
  const baseNote = radicalBaseNote(r);
  const explanation = buildShapeExplanation(character, s);
  return (
    <>
      <section className="mt-4" aria-labelledby="kanji-struktur">
        <h3 id="kanji-struktur" className="text-[16px] font-bold">
          Struktur Kanji
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
          <div className="min-w-0 rounded-xl bg-primary/[.07] p-3">
            <p className="text-[12px] text-muted-foreground">Bushu</p>
            <p lang="ja" className="mt-1 break-words font-jp text-[18px] font-semibold leading-6">
              {radicalTitle(r)}
            </p>
            {baseNote && <p className="text-[12px] text-muted-foreground">{baseNote}</p>}
            <p className="mt-1 text-[14px] leading-5">Arti: {r.meaningId}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-primary/[.07] p-3">
            <p className="text-[12px] text-muted-foreground">Komponen</p>
            {s.needsReview || s.components.length === 0 ? (
              <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
                {s.needsReview ? "Sedang ditinjau" : "Tidak diuraikan lagi"}
              </p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {s.components.map((c, i) =>
                  c.kanjiId && openableIds.has(c.kanjiId) ? (
                    <button
                      type="button"
                      key={`${c.c}-${i}`}
                      lang="ja"
                      aria-label={`Buka kanji ${c.c}`}
                      onClick={() => onOpen(c.kanjiId!)}
                      className={`${chipBase} ${chipLink}`}
                    >
                      {c.c}
                    </button>
                  ) : (
                    <span key={`${c.c}-${i}`} lang="ja" className={chipBase}>
                      {c.c}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
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
      {s.family.length > 0 && (
        <section className="mt-4" aria-labelledby="kanji-keluarga">
          <h3 id="kanji-keluarga" className="text-[16px] font-bold">
            Kanji dengan Bushu yang Sama
          </h3>
          <ul className="mt-2 grid grid-cols-3 gap-1.5 min-[420px]:grid-cols-4">
            {s.family.map((f) => {
              const body = (
                <>
                  <span lang="ja" className="font-jp text-[24px] font-semibold leading-8">
                    {f.character}
                  </span>
                  <span
                    lang="ja"
                    className="line-clamp-1 font-jp text-[12px] text-muted-foreground"
                  >
                    {f.reading ?? "—"}
                  </span>
                  <span className="line-clamp-1 text-[12px] leading-4 text-muted-foreground">
                    {f.meaningId ?? "—"}
                  </span>
                </>
              );
              const cls =
                "flex min-h-[76px] w-full min-w-0 flex-col items-center rounded-2xl border bg-card px-1 py-2 text-center";
              return (
                <li key={f.id} className="min-w-0">
                  {openableIds.has(f.id) ? (
                    <button
                      type="button"
                      aria-label={`Buka kanji ${f.character}`}
                      onClick={() => onOpen(f.id)}
                      className={`${cls} shadow-sm ${chipLink}`}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className={`${cls} opacity-80`}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {s.familyTotal > s.family.length && (
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Menampilkan {s.family.length} dari {s.familyTotal} kanji dengan bushu ini.
            </p>
          )}
        </section>
      )}
      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        Data struktur: KanjiVG (CC BY-SA 3.0) dan Kanji alive (CC BY 4.0).
      </p>
    </>
  );
}
