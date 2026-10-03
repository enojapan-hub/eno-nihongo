# Romaji / missing-Reading / Arti repair round

Offline tooling used for the audit-and-repair round that followed the Reading segmentation work
(PR #111). Nothing here runs in the app; everything is reproducible against a live snapshot
(`snap/live_pre2.json` = every example element before the round, fetched with
`apply/fetch_now.py`; the snapshots themselves are not committed).

| file | purpose |
|---|---|
| `rom.py`, `gen.py` | kana tables and the ENO-style romaji generator (ou/oo/uu long vowels, `cch` for っち, `n'` before vowels, は/へ/を = wa/e/o, compound particles `ni wa`, `de wa` ...) |
| `ralign.py` | Reading ↔ Romaji aligner: proves a romaji is the Reading (particles, gemination, long marks, katakana), returns word boundaries and the offsets where the romaji lacks a Reading boundary |
| `joins.py` | lexical-word rejoin rules used for Reading source repairs (`なん て`→`なんて`, `にど と`→`にどと`, `よぎ なく`→`よぎなく`, ...) |
| `plan_romaji.py` | reviewed Reading repairs (RF), romaji content patches (RP) and spacing insertions |
| `rec404.py`, `build404.py`, `rec404_final.json`, `arti404.py`, `arti404.json` | recovery of the 404 missing Readings (+ generated romaji) and the 321 Indonesian translations for the en-only rows |
| `build_plan.py` | merges every candidate into one master plan (table / primary key / JSON path / old / new / category / reason / validation source / confidence); `candidate_plan.tsv` is its reviewable export |
| `gensql2.py` | guarded, idempotent SQL per batch (md5 of the old value, jsonb_set on one key, targeted by id prefix + array index); batches: 1 missing Reading, 2 romaji, 3 arti, 4 source Reading repair |
| `mkexp.py`, `vfy_batch.py` | build the expected post-write snapshot and diff a fresh live fetch against it (proves only planned fields changed) |
| `validate_post.py` | romaji / arti / cross-field validator (Reading↔Romaji mismatch, romaji spacing vs Reading boundaries, particle romanization, known typos, digits, mixed script, polite-form splits, placeholders, non-Indonesian) |
| `../apply/final_validate_v2.py` | DB-diff safety + Reading categories for the round |
| `gen_fixture.py` | builds `src/lib/__tests__/fixtures/example-repair-round2.json` from the live snapshot |

Provenance rules: Japanese is never modified; a Reading is only recovered when Japanese + ENO
vocabulary/grammar + lemma/conjugation engine + Sudachi (analysis aid only) agree and a manual
review accepts it; anything ambiguous stays missing (e.g. `44bc25fd#1` 身体は洗った？ — からだ vs
しんたい). Known source quirks left unchanged and reported: `5506b37f#0` (ABC会社 かいしゃ vs
romaji gaisha), `4d04bd1c#0` (`ーー` dash in Japanese), three intentional usage annotations
(`（が）`, `（に）`, `（を）`).
