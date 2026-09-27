-- Read-only vocabulary audit validator (ENO NIHONGO kosakata). Official acceptance test.
-- Classifies every row of public.vocabulary into:
--   A = sudah benar, B = perlu diperbaiki, C = belum dikerjakan (required field empty),
--   D = tidak dapat diverifikasi otomatis.
-- Output: one row per level (N1-N5 + TOTAL) and one row per Minna no Nihongo
-- lesson for N4 (N4-bab-26 .. N4-bab-50), with per-issue counts.
-- Usage ("Penggunaan") source of truth: vocabulary.usage_note_id. While it is empty,
-- a valid vocabulary_senses.usage_note_id counts as a transitional fallback (usage_via_fallback),
-- mirroring pickUsageNote() in src/lib/vocab-resilient.ts. Bad usage = EN-meaning template,
-- generic boilerplate/label text, #NAME?, <15 chars, wiki markup, long Japanese run, English opener.
-- Baseline v2 (2026-09-27, production, after vocabulary.usage_note_id was added): see commit message.
-- v1 baseline (A 4635) is superseded: it did not detect template usage.
-- Use as the acceptance test after every data batch: A must not decrease,
-- and the targeted issue counts must drop to 0 for the processed rows.
-- SELECT only; safe to run against production.
with rmap(k,r) as (values ('きゃ','kya'),('きゅ','kyu'),('きょ','kyo'),('しゃ','sha'),('しゅ','shu'),('しょ','sho'),('ちゃ','cha'),('ちゅ','chu'),('ちょ','cho'),('にゃ','nya'),('にゅ','nyu'),('にょ','nyo'),('ひゃ','hya'),('ひゅ','hyu'),('ひょ','hyo'),('みゃ','mya'),('みゅ','myu'),('みょ','myo'),('りゃ','rya'),('りゅ','ryu'),('りょ','ryo'),('ぎゃ','gya'),('ぎゅ','gyu'),('ぎょ','gyo'),('じゃ','ja'),('じゅ','ju'),('じょ','jo'),('ぢゃ','ja'),('ぢゅ','ju'),('ぢょ','jo'),('びゃ','bya'),('びゅ','byu'),('びょ','byo'),('ぴゃ','pya'),('ぴゅ','pyu'),('ぴょ','pyo'),('しぇ','she'),('ちぇ','che'),('じぇ','je'),('ふぁ','fa'),('ふぃ','fi'),('ふぇ','fe'),('ふぉ','fo'),('てぃ','ti'),('でぃ','di'),('とぅ','tu'),('どぅ','du'),('うぃ','wi'),('うぇ','we'),('うぉ','wo'),('ゔぁ','va'),('ゔぃ','vi'),('ゔぇ','ve'),('ゔぉ','vo'),('つぁ','tsa'),('つぃ','tsi'),('つぇ','tse'),('つぉ','tso'),('いぇ','ye'),('あ','a'),('い','i'),('う','u'),('え','e'),('お','o'),('か','ka'),('き','ki'),('く','ku'),('け','ke'),('こ','ko'),('さ','sa'),('し','shi'),('す','su'),('せ','se'),('そ','so'),('た','ta'),('ち','chi'),('つ','tsu'),('て','te'),('と','to'),('な','na'),('に','ni'),('ぬ','nu'),('ね','ne'),('の','no'),('は','ha'),('ひ','hi'),('ふ','fu'),('へ','he'),('ほ','ho'),('ま','ma'),('み','mi'),('む','mu'),('め','me'),('も','mo'),('や','ya'),('ゆ','yu'),('よ','yo'),('ら','ra'),('り','ri'),('る','ru'),('れ','re'),('ろ','ro'),('わ','wa'),('を','o'),('が','ga'),('ぎ','gi'),('ぐ','gu'),('げ','ge'),('ご','go'),('ざ','za'),('じ','ji'),('ず','zu'),('ぜ','ze'),('ぞ','zo'),('だ','da'),('ぢ','ji'),('づ','zu'),('で','de'),('ど','do'),('ば','ba'),('び','bi'),('ぶ','bu'),('べ','be'),('ぼ','bo'),('ぱ','pa'),('ぴ','pi'),('ぷ','pu'),('ぺ','pe'),('ぽ','po'),('ゔ','vu'),('ゐ','i'),('ゑ','e'),('ぁ','a'),('ぃ','i'),('ぅ','u'),('ぇ','e'),('ぉ','o'),('ゃ','ya'),('ゅ','yu'),('ょ','yo'),('ゎ','wa'),('ゕ','ka'),('ゖ','ke'),('ん','n'),('っ',''),('ー','')),
rconv as (
  select v.id, string_agg(coalesce(m.r, t.tok[1]), '' order by t.ord) conv
  from vocabulary v
  cross join lateral regexp_matches(translate(v.reading,'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ','ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ'), '[きしちにひみりぎじぢびぴ][ゃゅょ]|[しちじ]ぇ|ふ[ぁぃぇぉ]|[てで]ぃ|[とど]ぅ|う[ぃぇぉ]|ゔ[ぁぃぇぉ]|つ[ぁぃぇぉ]|いぇ|.', 'g') with ordinality t(tok, ord)
  left join rmap m on m.k=t.tok[1]
  where nullif(btrim(v.reading),'') is not null
  group by v.id
),
rnorm as (select r.id, regexp_replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(regexp_replace(translate(lower(r.conv),'āīūēôâîûêōÂĀŌŪ','aiueoaiueoaaou'),'[^a-z]','','g'),'cch','ch'),'tch','ch'),'wa','ha'),'tch','tt'),'shi','si'),'chi','ti'),'tsu','tu'),'fu','hu'),'ji','zi'),'sh','sy'),'ch','ty'),'j','zy'),'du','zu'),'di','zi'),'dy','zy'),'wo','o'),'mb','nb'),'mp','np'),'ou','o'),'ei','e'),'([a-z])\1+','\1','g') rr, regexp_replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(regexp_replace(translate(lower(v.romaji),'āīūēôâîûêōÂĀŌŪ','aiueoaiueoaaou'),'[^a-z]','','g'),'cch','ch'),'tch','ch'),'wa','ha'),'tch','tt'),'shi','si'),'chi','ti'),'tsu','tu'),'fu','hu'),'ji','zi'),'sh','sy'),'ch','ty'),'j','zy'),'du','zu'),'di','zi'),'dy','zy'),'wo','o'),'mb','nb'),'mp','np'),'ou','o'),'ei','e'),'([a-z])\1+','\1','g') rm from rconv r join vocabulary v on v.id=r.id),
ur as (
  select v.id vocabulary_id, 0 src, v.usage_note_id u from vocabulary v
  union all
  select s.vocabulary_id, 1, s.usage_note_id from vocabulary_senses s
),
urf as (
  select ur.*, nullif(btrim(u),'') is not null present,
    coalesce(u ~ '^Kata [A-Za-z -]+ (yang )?digunakan untuk menyatakan “', false) tpl_en,
    coalesce(u ~ 'Dapat (menjadi|dipakai sebagai) (topik|subjek)'
      or u ~ '^Penggunaan pada materi N[1-5]:'
      or u ~ '^(Penggunaan sesuai arti|Digunakan sebagai kata kerja sesuai maknanya|Dipakai sebagai kata kerja sesuai maknanya)', false) tpl_generic,
    coalesce(char_length(btrim(u))<15 or position('{{' in u)>0 or position('[[' in u)>0
      or u ~ '[一-鿿ぁ-ゟ゠-ヿ]{25,}' or u ~* '^(used |this word|a word|the word|to )'
      or position('#NAME?' in u)>0, false) other_bad,
    -- legacy (v1) usage rule, kept only to compare against the superseded baseline
    coalesce(char_length(btrim(u))<15 or position('{{' in u)>0 or position('[[' in u)>0
      or u ~ '[一-鿿ぁ-ゟ゠-ヿ]{25,}' or u ~* '^(used |this word|a word|the word|to )'
      or u in ('Penggunaan sesuai arti dan contoh kosakata N2 yang telah diverifikasi.','Digunakan sebagai kata kerja sesuai maknanya; perhatikan partikel dan pasangan transitif atau intransitif bila ada.'), false) legacy_bad
  from ur
),
sx as (
  select vocabulary_id,
    count(*) filter (where src=1) n_s,
    bool_or(src=0 and present) vu_present,
    bool_or(src=0 and present and (tpl_en or tpl_generic or other_bad)) vu_bad,
    bool_or(src=1 and present) su_present,
    bool_or(src=1 and present and not (tpl_en or tpl_generic or other_bad)) su_valid,
    bool_or(src=1 and present and tpl_en) su_tpl_en,
    bool_or(src=1 and present and tpl_generic) su_tpl_generic,
    bool_or(src=1 and present and legacy_bad) su_legacy_bad
  from urf group by 1
),
base as (
  select v.*, coalesce(sx.n_s,0) n_s, sx.vu_present, sx.vu_bad, sx.su_present, sx.su_valid, sx.su_tpl_en, sx.su_tpl_generic, sx.su_legacy_bad,
    nullif(regexp_replace(v.term,'[ぁ-ゟ〜～]+$',''),'') stem,
    substring(v.term from '[一-鿿々]') k1, n.rr, n.rm
  from vocabulary v left join sx on sx.vocabulary_id=v.id left join rnorm n on n.id=v.id
),
exs as (
  select b.id, 0 src, 0 sord, t.ord, t.x
  from base b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.examples)='array' then b.examples else '[]'::jsonb end) with ordinality t(x, ord)
  union all
  select s.vocabulary_id, 1, row_number() over (partition by s.vocabulary_id order by s.created_at, s.id), t.ord, t.x
  from vocabulary_senses s cross join lateral jsonb_array_elements(case when jsonb_typeof(s.examples)='array' then s.examples else '[]'::jsonb end) with ordinality t(x, ord)
),
exf0 as (
  select e.id, e.src, e.sord, e.ord,
    coalesce(e.x->>'ja', e.x->>'jp', e.x->>'japanese') ja, e.x->>'id' idt, e.x->>'reading' rd, e.x->>'romaji' rj
  from exs e where jsonb_typeof(e.x)='object'
),
exf1 as (
  select f.*, row_number() over (partition by f.id, regexp_replace(coalesce(f.ja,''),'[[:space:]]','','g') order by f.src, f.sord, f.ord) dn
  from exf0 f
),
exf as (
  select f.*, row_number() over (partition by f.id order by f.src, f.sord, f.ord) vis
  from exf1 f where f.dn=1 or coalesce(f.ja,'')=''
),
exa as (
  select f.id,
    count(*) filter (where f.vis<=3) n_ex,
    count(*) filter (where f.vis<=3 and nullif(btrim(f.ja),'') is not null and f.ja ~ '[ぁ-ゟ゠-ヿ一-鿿]' and nullif(btrim(f.idt),'') is not null and f.idt ~ '[A-Za-z]') n_ex_ok,
    bool_or(f.vis<=3 and (nullif(btrim(f.ja),'') is null or f.ja !~ '[ぁ-ゟ゠-ヿ一-鿿]')) ex_ja_bad,
    bool_or(f.vis<=3 and (nullif(btrim(f.idt),'') is null or f.idt !~ '[A-Za-z]')) ex_id_bad,
    bool_or(f.vis<=3 and nullif(btrim(f.rd),'') is null) ex_rd_missing,
    bool_or(f.vis<=3 and f.rd ~ '[一-鿿々]') ex_rd_bad,
    bool_or(f.vis<=3 and nullif(btrim(f.rj),'') is null) ex_rj_missing,
    bool_or(f.vis<=3 and f.rj ~ '[ぁ-ゟ゠-ヿ一-鿿]') ex_rj_bad,
    bool_or(f.src=0 and (position(b.term in f.ja)>0 or (b.stem is not null and position(b.stem in f.ja)>0) or (nullif(btrim(b.reading),'') is not null and position(b.reading in coalesce(f.ja,'')||coalesce(f.rd,''))>0) or (b.k1 is not null and position(b.k1 in f.ja)>0))) ex_has_target,
    bool_or(f.vis>3 and (nullif(btrim(f.idt),'') is null or nullif(btrim(f.rd),'') is null)) hidden_bad
  from exf f join base b on b.id=f.id group by f.id
),
dup as (
  select id, count(*) over (partition by level, regexp_replace(term,'[[:space:]]','','g'), coalesce(reading,'')) n_same_level,
         count(*) over (partition by regexp_replace(term,'[[:space:]]','','g'), coalesce(reading,'')) n_all
  from vocabulary
),
a as (
  select b.id, b.level::text lvl, b.term, b.sort_order, b.source_book, b.lesson_number,
    (nullif(btrim(b.reading),'') is null) miss_reading,
    (b.reading ~ '[一-鿿々A-Za-z0-9０-９]' or b.reading like '%だいだい%') bad_reading,
    (nullif(btrim(b.romaji),'') is null) miss_romaji,
    (b.romaji ~ '[ぁ-ゟ゠-ヿ一-鿿]' or b.romaji !~ '[A-Za-z]') bad_romaji,
    (nullif(btrim(b.reading),'') is not null and nullif(btrim(b.romaji),'') is not null and b.reading !~ '[一-鿿々A-Za-z（）()]' and b.romaji !~ '[()（）]' and b.rr<>b.rm) romaji_mismatch,
    (b.reading ~ '[（）()]' or b.romaji ~ '[()（）]') romaji_unverifiable,
    (nullif(btrim(b.meaning_id),'') is null) miss_meaning,
    (b.meaning_id !~ '[A-Za-z]' or btrim(b.meaning_id) in ('-','?','...','TODO','todo','n/a','N/A')) bad_meaning,
    (nullif(btrim(b.meaning_en),'') is not null and lower(btrim(b.meaning_id))=lower(btrim(b.meaning_en)) and btrim(b.meaning_id) ~ ' ') meaning_is_en,
    (nullif(btrim(b.meaning_en),'') is not null and lower(btrim(b.meaning_id))=lower(btrim(b.meaning_en)) and btrim(b.meaning_id) !~ ' ') meaning_eq_en_1word,
    (b.meaning_id ~* '(^|[ ;,(])(to be|the|of the|something|someone|one''s)( |$|[;,)])' or b.meaning_id ~* '^to [a-z]') meaning_english_like,
    (nullif(btrim(b.part_of_speech),'') is null) miss_pos,
    (b.part_of_speech ilike 'kosakata contoh kanji') bad_pos,
    (b.term !~ '[ぁ-ゟ゠-ヿ一-鿿々]' or (b.term !~ '^「' and b.term !~ '。$' and b.term ~ '[。;；].') or b.term<>btrim(b.term)) bad_term,
    (b.term ~ '^「' or b.term ~ '。$' or b.term ~ '[、,，].') phrase_entry,
    (b.term ~ '[A-Za-z]') term_latin,
    coalesce(x.n_ex,0) n_ex, coalesce(x.n_ex_ok,0) n_ex_ok,
    coalesce(x.ex_ja_bad,false) ex_ja_bad, coalesce(x.ex_id_bad,false) ex_id_bad,
    coalesce(x.ex_rd_missing,false) ex_rd_missing, coalesce(x.ex_rd_bad,false) ex_rd_bad,
    coalesce(x.ex_rj_missing,false) ex_rj_missing, coalesce(x.ex_rj_bad,false) ex_rj_bad,
    coalesce(x.ex_has_target,false) ex_has_target, coalesce(x.hidden_bad,false) hidden_bad,
    (not b.vu_present and not b.su_present) miss_usage,
    ((b.vu_present and b.vu_bad) or (not b.vu_present and b.su_present and not b.su_valid)) usage_bad,
    (not b.vu_present and b.su_present and not b.su_valid and b.su_tpl_en) usage_tpl_en,
    (not b.vu_present and b.su_present and not b.su_valid and not b.su_tpl_en and b.su_tpl_generic) usage_generic,
    (b.vu_present and not b.vu_bad) usage_from_vocab,
    (not b.vu_present and b.su_valid) usage_via_fallback,
    (not b.su_present) legacy_miss_usage, b.su_legacy_bad legacy_usage_bad, b.n_s,
    (d.n_same_level>1) dup_level, (d.n_all>d.n_same_level) dup_cross
  from base b left join exa x on x.id=b.id join dup d on d.id=b.id
),
c as (
  select a.*,
    (miss_reading or miss_romaji or miss_meaning or miss_pos or n_ex_ok=0 or miss_usage) is_c,
    (bad_reading or bad_romaji or romaji_mismatch or bad_meaning or meaning_is_en or meaning_english_like or bad_pos or bad_term or ex_ja_bad or ex_id_bad or ex_rd_bad or ex_rj_bad or ex_rd_missing or usage_bad or dup_level) is_b,
    (romaji_unverifiable or meaning_eq_en_1word or term_latin or phrase_entry or not ex_has_target) is_d,
    -- category under the superseded v1 usage rule (for baseline comparison only)
    not (miss_reading or miss_romaji or miss_meaning or miss_pos or n_ex_ok=0 or legacy_miss_usage)
      and not (bad_reading or bad_romaji or romaji_mismatch or bad_meaning or meaning_is_en or meaning_english_like or bad_pos or bad_term or ex_ja_bad or ex_id_bad or ex_rd_bad or ex_rj_bad or ex_rd_missing or legacy_usage_bad or dup_level)
      and not (romaji_unverifiable or meaning_eq_en_1word or term_latin or phrase_entry or not ex_has_target) was_a_v1
  from a
)
select coalesce(lvl,'TOTAL') lvl, count(*) total,
 count(*) filter (where not is_c and not is_b and not is_d) a_ok,
 count(*) filter (where not is_c and is_b) b_fix,
 count(*) filter (where is_c) c_todo,
 count(*) filter (where not is_c and not is_b and is_d) d_unverif,
 count(*) filter (where bad_reading) bad_reading, count(*) filter (where romaji_mismatch) romaji_mismatch, count(*) filter (where romaji_unverifiable) romaji_unverif,
 count(*) filter (where bad_meaning) bad_meaning, count(*) filter (where meaning_is_en) meaning_is_en, count(*) filter (where meaning_eq_en_1word) meaning_eq_en_1w,
 count(*) filter (where bad_pos) bad_pos, count(*) filter (where bad_term) bad_term, count(*) filter (where phrase_entry) phrase_entry, count(*) filter (where term_latin) term_latin,
 count(*) filter (where n_ex_ok=0) no_valid_ex, count(*) filter (where n_ex_ok=1) ex1, count(*) filter (where n_ex_ok=2) ex2, count(*) filter (where n_ex_ok>=3) ex3,
 count(*) filter (where ex_id_bad) ex_id_bad, count(*) filter (where ex_rd_missing) ex_rd_miss, count(*) filter (where ex_rd_bad) ex_rd_bad, count(*) filter (where not ex_has_target) ex_no_target, count(*) filter (where hidden_bad) hidden_bad,
 count(*) filter (where miss_usage) miss_usage, count(*) filter (where n_s=0) no_sense, count(*) filter (where usage_bad) usage_bad,
 count(*) filter (where usage_tpl_en) usage_tpl_en, count(*) filter (where usage_generic) usage_generic,
 count(*) filter (where usage_from_vocab) usage_from_vocab, count(*) filter (where usage_via_fallback) usage_via_fallback,
 count(*) filter (where was_a_v1) a_v1, count(*) filter (where was_a_v1 and not (not is_c and not is_b and not is_d)) a_v1_downgraded,
 count(*) filter (where dup_level) dup_level, count(*) filter (where dup_cross) dup_cross
from c group by rollup(lvl)
union all
select 'N4-bab-'||lpad(lesson_number::text,2,'0'), count(*),
 count(*) filter (where not is_c and not is_b and not is_d), count(*) filter (where not is_c and is_b), count(*) filter (where is_c), count(*) filter (where not is_c and not is_b and is_d),
 null,null,null,null,null,null,null,null,null,null,null,null,null,null,
 count(*) filter (where ex_id_bad), count(*) filter (where ex_rd_missing), null, count(*) filter (where not ex_has_target), null,
 count(*) filter (where miss_usage), null, null, null, null, null, null, null, null, null, null
from c where lvl='N4' and source_book ilike '%minna%' group by lesson_number
order by 1
