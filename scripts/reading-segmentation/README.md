# Reading segmentation tool (offline)

Segments the hiragana `reading` of example sentences into natural word units (分かち書き) from the
Japanese text (`ja`) and the stored reading. It is an offline data tool; the app itself only
normalises display (`src/lib/japanese-spacing.ts`) and validates structure
(`src/lib/reading-validator.ts`).

```
pip install -r requirements.txt
python seg2.py "この本には、くわしい説明は書かれていません。" "このほんには、くわしいせつめいはかかれていません。"
# → この ほん には、くわしい せつめい は かかれて いません。
```

## How it works

1. `ja` is tokenised with Sudachi (mode A, plus mode C for lexicalised compounds).
2. Each token's reading is aligned to the stored reading (weighted edit alignment; kana tokens are
   anchors, kanji tokens may differ in reading: 明日 あす/あした, 一 いち/いっ, numerals via
   `numkana.py`, alternative readings learnt from the corpus/vocabulary in `buildalt.py`).
   A boundary is only used when its position is unique; otherwise the row is reported.
3. `decide()` classifies each boundary as join/space and as *hard* (always enforced, also on
   already-spaced rows) or *soft* (authored spacing is kept where it already exists).
4. Over-long compound nouns (> 9 morae) are split at the best word boundary.
5. Characters are never changed: the output without spaces equals the input reading.

## Convention (word-based 標準分かち書き)

Validated against the 標準分かち書き (kanamozi.org), MEXT braille wakachigaki guidance, TRC MARC
wakachi rules and bunka.go.jp (kokugo council) notes:

- particles are written apart from the preceding word (`せつめい は`), compound particle pairs stay
  together (`には`, `とは`, `からの`, `までに`);
- conjugation endings and auxiliaries stay attached (`かかれて`, `いません`, `たべたい`, `しました`);
- supplementary verbs/adjectives are separate words (`かかれて いません`, `して ください`);
- the copula is separate (`ほん です`, `しずか な`); suffixes/prefixes/counters stay attached;
- punctuation never takes a space on either side (`らいねん、かぞく に あう。`);
- fixed expressions stay whole (`ありがとうございます`, `とともに`, `ものともせず`).

`overrides.py` holds the rows (Latin letters, source typos, rare kanji, ambiguous readings) that were
resolved by hand (27 sentences, all pinned as `manual correction` fixtures).
Inputs: `vocab_terms.json` ([{term, reading}] from `vocabulary`) and `all.json` (examples with owner/idx) are exports of the live data; `alt.json` is produced by `buildalt.py`.

## Learner-oriented segmenter (`seg2.py`, current)

`seg2.py` supersedes `segmenter.py` (kept only for history). It adds, on top of the steps above:

- `eno_lex.py` builds a lexicon from the ENO vocabulary (`eno_lex.json`, regenerate with
  `vocab_full.json`) so lexicalised units (suru-verb nouns, compound nouns, fixed expressions such as
  `にさいして`, `ありがとう`) stay whole;
- `conj.py` is a conjugation engine (Group 1/2/3, irregular `くる`/`する`/`いく`/`ある`, adjectives,
  ます/て/ない/普通形, passive/causative) that *predicts* the expected stem of every verb/adjective and
  checks it against the stored reading, so a conjugated form is never cut (`かかれて`, `おこなわれます`);
- `final2.py` turns the segmenter output into write candidates (`final2.json`), classifying rows as
  already-correct, `C-unsegmented`, `C-invalid-split` or `B` (style) and excluding source-corrupt rows
  into `source_corrupt.json` (never auto-fixed).

### Applying to the database (guarded, idempotent)

`apply/plan_write.py` + `apply/tmpl.sql` generate per-table batches of 400 elements. Each row carries a
6-char md5 guard of the *old* value and base62 segment lengths; the server rebuilds the spaced string
from the space-stripped old value, so a batch can only add spaces, only where the old value is
unchanged, and re-running it is a no-op. No DELETE, no RLS/permission change.

`apply/fetch_pre.py` / `fetch_now.py` snapshot the live elements (needs `E2E_EMAIL`/`E2E_PASSWORD`,
the public Supabase URL and publishable key), `apply/vfy.py` classifies every element as
`unchanged` / `as-planned` / `UNEXPECTED` and lists remaining planned rows, and `apply/post.py` checks the
whole dataset (non-target fields unchanged, chars unchanged, no double-space, no space after 、 or before
。). These scripts expect their input/output JSON files (`final2.json`, `write_plan.json`, `snap/`) in
the working directory; those data exports are not committed.

### Result of the run on the live data (19,653 example elements)

- 17,277 elements re-segmented (15,326 unsegmented, 487 invalid split, 1,464 style), 2,376 untouched.
- Post-write: 17,277/17,277 as planned, 0 unexpected, `ja`/`romaji`/`id` unchanged everywhere,
  characters unchanged (spacing only), 0 double-space, 0 space after 、, 0 space before 。.
- Final live validation (`apply/final_validate.py`, 19,249 elements with a reading; 404 `vocabulary_senses` elements have no reading field): 0 unexpected DB changes, 0 invalid splits, 0 unsegmented/particle errors, 0 punctuation/double-space errors; 94 conjugation flags are predictor default-reading limits (e.g. 引っ→ひっ, 止める→やめる/とどめる, 来まい→こまい), each checked against Sudachi / the ENO entry reading.
- Second review pass (Exa-assisted) repaired 6 more rows: `かお っと` (っと is a final particle), `イコール きょうかい`, `に たす に イコール よん`, `ゼロカロリー`, plus spacing of two rows whose reading matches their `ja`. Three `（が）/（に）/（を）` rows are intentional usage annotations and stay unresolved/untouched.
- 3 source-corrupt rows with a *provable* fix (raw digits in `reading`, kana known from `romaji` or a
  twin row) were repaired in a separate guarded batch; the other 7 (digits with no recorded reading,
  stray annotations such as `（が）`, `ja` typos) are reported, not changed.

## Romaji / missing-Reading / Arti round

See `romaji-round/README.md` — audit of all four example fields, recovery of the 404 missing
Readings, Indonesian meaning repairs, guarded write batches and the round-2 validators.
