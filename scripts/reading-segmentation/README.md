# Reading segmentation tool (offline)

Segments the hiragana `reading` of example sentences into natural word units (分かち書き) from the
Japanese text (`ja`) and the stored reading. It is an offline data tool; the app itself only
normalises display (`src/lib/japanese-spacing.ts`) and validates structure
(`src/lib/reading-validator.ts`).

```
pip install -r requirements.txt
python segmenter.py "この本には、くわしい説明は書かれていません。" "このほんには、くわしいせつめいはかかれていません。"
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

`overrides.py` holds the few rows (Latin letters, source typos) that were resolved by hand.
Inputs: `vocab_terms.json` ([{term, reading}] from `vocabulary`) and `all.json` (examples with owner/idx) are exports of the live data; `alt.json` is produced by `buildalt.py`.
