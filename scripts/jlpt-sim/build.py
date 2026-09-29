#!/usr/bin/env python3
"""Build ENO NIHONGO JLPT full-simulation exams (exam_no 2-5) from compact sources.

Source: supabase/seed/jlpt-simulation/src/<LEVEL>-exam<N>.txt
Output: supabase/seed/jlpt-simulation/<LEVEL>-exam<N>.json (rows for jlpt_simulation_questions)

Source format
  @M <section> <mondai_no> <question_type>
  prompt | choice1 | choice2 | choice3 | choice4 | <correct 1-4>
  @P <passage title>            (passage for the following questions, until @END)
  ...passage lines...
  @END
  [[target]] marks the tested part of a prompt (stored as target_text/target_occurrence).
Listening (choukai) slots are generated from the level structure as PENDING_CONTENT
records (is_published=false, no audio/transcript) so they can be filled later.
"""
import json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "supabase/seed/jlpt-simulation/src"
OUT = ROOT / "supabase/seed/jlpt-simulation"

# Official JLPT structure per level (current test specification).
# section -> [(mondai_no, question_type, count)]
STRUCT = {
  "N5": {
    "sessions": {"vocabulary": 1, "grammar": 2, "reading": 2, "listening": 3},
    "vocabulary": [(1, "kanji_reading", 7), (2, "orthography", 5), (3, "context_vocabulary", 6), (4, "paraphrase", 3)],
    "grammar": [(1, "grammar_choice", 9), (2, "sentence_composition", 4), (3, "text_grammar", 4)],
    "reading": [(4, "short_passage", 2), (5, "medium_passage", 2), (6, "information_retrieval", 1)],
    "listening": [(1, "task_comprehension", 7, 4), (2, "point_comprehension", 6, 4), (3, "picture_response", 5, 3), (4, "quick_response", 6, 3)],
  },
  "N4": {
    "sessions": {"vocabulary": 1, "grammar": 2, "reading": 2, "listening": 3},
    "vocabulary": [(1, "kanji_reading", 7), (2, "orthography", 5), (3, "context_vocabulary", 8), (4, "paraphrase", 4), (5, "usage", 4)],
    "grammar": [(1, "grammar_choice", 13), (2, "sentence_composition", 4), (3, "text_grammar", 4)],
    "reading": [(4, "short_passage", 3), (5, "medium_passage", 3), (6, "information_retrieval", 2)],
    "listening": [(1, "task_comprehension", 8, 4), (2, "point_comprehension", 7, 4), (3, "picture_response", 5, 3), (4, "quick_response", 8, 3)],
  },
  "N3": {
    "sessions": {"vocabulary": 1, "grammar": 2, "reading": 2, "listening": 3},
    "vocabulary": [(1, "kanji_reading", 8), (2, "orthography", 6), (3, "context_vocabulary", 11), (4, "paraphrase", 5), (5, "usage", 5)],
    "grammar": [(1, "grammar_choice", 13), (2, "sentence_composition", 5), (3, "text_grammar", 5)],
    "reading": [(4, "short_passage", 4), (5, "medium_passage", 6), (6, "long_passage", 4), (7, "information_retrieval", 2)],
    "listening": [(1, "task_comprehension", 6, 4), (2, "point_comprehension", 6, 4), (3, "summary_comprehension", 3, 4), (4, "picture_response", 4, 3), (5, "quick_response", 9, 3)],
  },
  "N2": {
    "sessions": {"vocabulary": 1, "grammar": 1, "reading": 1, "listening": 2},
    "vocabulary": [(1, "kanji_reading", 5), (2, "orthography", 5), (3, "word_formation", 5), (4, "context_vocabulary", 7), (5, "paraphrase", 5), (6, "usage", 5)],
    "grammar": [(7, "grammar_choice", 12), (8, "sentence_composition", 5), (9, "text_grammar", 5)],
    "reading": [(10, "short_passage", 5), (11, "medium_passage", 9), (12, "integrated_comprehension", 2), (13, "thematic_comprehension", 3), (14, "information_retrieval", 2)],
    "listening": [(1, "task_comprehension", 5, 4), (2, "point_comprehension", 6, 4), (3, "summary_comprehension", 5, 4), (4, "quick_response", 12, 3), (5, "integrated_comprehension", 4, 4)],
  },
  "N1": {
    "sessions": {"vocabulary": 1, "grammar": 1, "reading": 1, "listening": 2},
    "vocabulary": [(1, "kanji_reading", 6), (2, "context_vocabulary", 7), (3, "paraphrase", 6), (4, "usage", 6)],
    "grammar": [(5, "grammar_choice", 10), (6, "sentence_composition", 5), (7, "text_grammar", 5)],
    "reading": [(8, "short_passage", 4), (9, "medium_passage", 9), (10, "long_passage", 4), (11, "integrated_comprehension", 3), (12, "thematic_comprehension", 4), (13, "information_retrieval", 2)],
    "listening": [(1, "task_comprehension", 6, 4), (2, "point_comprehension", 7, 4), (3, "summary_comprehension", 6, 4), (4, "quick_response", 14, 3), (5, "integrated_comprehension", 4, 4)],
  },
}

KANA_LEVELS = {"N5", "N4"}

def instruction(level, section, mondai, qtype, qfrom, qto):
    easy = level in KANA_LEVELS
    t = {
      "kanji_reading": "＿＿＿の ことばは ひらがなで どう かきますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。" if easy else "＿＿＿の言葉の読み方として最もよいものを、1・2・3・4から一つ選びなさい。",
      "orthography": "＿＿＿の ことばは どう かきますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。" if easy else "＿＿＿の言葉を漢字で書くとき、最もよいものを、1・2・3・4から一つ選びなさい。",
      "word_formation": "（　）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
      "context_vocabulary": "（　）に なにを いれますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。" if easy else "（　）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
      "paraphrase": "＿＿＿の ぶんと だいたい おなじ いみの ぶんが あります。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。" if easy else "＿＿＿に意味が最も近いものを、1・2・3・4から一つ選びなさい。",
      "usage": "つぎの ことばの つかいかたで いちばん いい ものを 1・2・3・4から ひとつ えらんで ください。" if easy else "次の言葉の使い方として最もよいものを、1・2・3・4から一つ選びなさい。",
      "grammar_choice": "（　）に 何を 入れますか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。" if easy else "次の文の（　）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。",
      "sentence_composition": "★ に 入る ものは どれですか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。" if easy else "次の文の ★ に入る最もよいものを、1・2・3・4から一つ選びなさい。",
      "text_grammar": f"つぎの 文章を 読んで、文章全体の 内容を 考えて、{qfrom}から{qto}に 入る いちばん いい ものを 1・2・3・4から 一つ えらんで ください。" if easy else f"次の文章を読んで、文章全体の内容を考えて、{qfrom}から{qto}の中に入る最もよいものを、1・2・3・4から一つ選びなさい。",
      "short_passage": "つぎの 文章を 読んで、しつもんに こたえて ください。こたえは、1・2・3・4から いちばん いい ものを 一つ えらんで ください。" if easy else "次の文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。",
      "medium_passage": "つぎの 文章を 読んで、しつもんに こたえて ください。こたえは、1・2・3・4から いちばん いい ものを 一つ えらんで ください。" if easy else "次の文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。",
      "long_passage": "次の文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。",
      "integrated_comprehension": "次のAとBの文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。",
      "thematic_comprehension": "次の文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。",
      "information_retrieval": "右の ページの おしらせを 見て、下の しつもんに こたえて ください。こたえは、1・2・3・4から いちばん いい ものを 一つ えらんで ください。" if easy else "右のページの案内を見て、下の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。",
    }[qtype]
    return f"問題{mondai}　{t}" if not easy or section != "listening" else t

LISTEN_INS = {
  "task_comprehension": "まず質問を聞いてください。それから話を聞いて、問題用紙の1から4の中から、最もよいものを一つ選んでください。",
  "point_comprehension": "まず質問を聞いてください。そのあと、問題用紙の選択肢を読んでください。それから話を聞いて、1から4の中から最もよいものを一つ選んでください。",
  "summary_comprehension": "問題用紙に何も印刷されていません。まず話を聞いてください。それから、質問と選択肢を聞いて、1から4の中から最もよいものを一つ選んでください。",
  "picture_response": "絵を見ながら質問を聞いてください。→（やじるし）の人は何と言いますか。1から3の中から最もよいものを一つ選んでください。",
  "quick_response": "問題用紙に何も印刷されていません。まず文を聞いてください。それから、それに対する返事を聞いて、1から3の中から最もよいものを一つ選んでください。",
  "integrated_comprehension": "長めの話を聞きます。問題用紙に何も印刷されていません。まず話を聞いてください。それから、質問と選択肢を聞いて、1から4の中から最もよいものを一つ選んでください。",
}
LISTEN_INS_EASY = {
  "task_comprehension": "はじめに しつもんを きいて ください。それから はなしを きいて、もんだいようしの 1から4の なかから、いちばん いい ものを ひとつ えらんで ください。",
  "point_comprehension": "はじめに しつもんを きいて ください。そのあと、もんだいようしを 見て ください。よむ じかんが あります。それから はなしを きいて、もんだいようしの 1から4の なかから、いちばん いい ものを ひとつ えらんで ください。",
  "picture_response": "えを 見ながら しつもんを きいて ください。→（やじるし）の ひとは なんと いいますか。1から3の なかから、いちばん いい ものを ひとつ えらんで ください。",
  "quick_response": "えなどが ありません。ぶんを きいて、1から3の なかから、いちばん いい ものを ひとつ えらんで ください。",
}

MARK = re.compile(r"\[\[(.+?)\]\]")
KANJI = re.compile(r"[一-鿿々]")
KANA_ONLY = re.compile(r"^[぀-ヿー・　 ]+$")

def norm(s):
    return re.sub(r"[\s　]", "", unicodedata.normalize("NFKC", s or ""))

def parse(path):
    level = path.stem.split("-")[0]
    exam = int(path.stem.split("exam")[1])
    items, cur, passage, title, mode, buf = [], None, None, None, None, []
    for ln, raw in enumerate(path.read_text().splitlines(), 1):
        line = raw.rstrip()
        if mode == "P":
            if line.strip() == "@END":
                passage, mode = "\n".join(buf).strip(), None
            else:
                buf.append(line)
            continue
        if not line.strip() or line.startswith("#"):
            continue
        if line.startswith("@M "):
            _, sec, m, qt = line.split()
            cur = (sec, int(m), qt); passage = None; title = None
            continue
        if line.startswith("@P"):
            title = line[2:].strip() or None; buf = []; mode = "P"
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) != 6:
            raise SystemExit(f"{path.name}:{ln}: expected 6 fields, got {len(parts)}")
        prompt_src, *choices, ans = parts
        m = MARK.search(prompt_src)
        target = occ = None
        if m:
            target = m.group(1)
            before = prompt_src[: m.start()]
            occ = MARK.sub(lambda x: x.group(1), before).count(target) + 1
        prompt = MARK.sub(lambda x: x.group(1), prompt_src)
        items.append(dict(section=cur[0], mondai_no=cur[1], question_type=cur[2], prompt_jp=prompt,
                          choices=choices, correct_index=int(ans) - 1, passage_title=title,
                          passage_jp=passage, target_text=target, target_occurrence=occ if target else None, _ln=ln))
    return level, exam, items

def build(path, exam1_keys, seen_global):
    level, exam, items = parse(path)
    st = STRUCT[level]
    errs = []
    rows = []
    # numbering: N3-N5 two booklets (vocabulary | grammar+reading); N1/N2 one booklet
    counters = {}
    def booklet(sec):
        return "lang" if level in ("N1", "N2") else ("vocab" if sec == "vocabulary" else "gr")
    by_mondai = {}
    for it in items:
        by_mondai.setdefault((it["section"], it["mondai_no"]), []).append(it)
    for sec in ("vocabulary", "grammar", "reading"):
        for (m, qt, n) in st[sec]:
            got = by_mondai.pop((sec, m), [])
            if len(got) != n:
                errs.append(f"{sec} M{m}: expected {n}, got {len(got)}")
            nums = []
            for it in got:
                b = booklet(sec)
                counters[b] = counters.get(b, 0) + 1
                it["question_no"] = counters[b]
                nums.append(counters[b])
                if it["question_type"] != qt:
                    errs.append(f"{sec} M{m} L{it['_ln']}: type {it['question_type']} != {qt}")
            for it in got:
                it["instruction_jp"] = instruction(level, sec, m, qt, nums[0] if nums else 0, nums[-1] if nums else 0)
                rows.append(it)
    for k in by_mondai:
        errs.append(f"unexpected mondai {k}")
    # validation
    for it in rows:
        tag = f"{it['section']} M{it['mondai_no']} Q{it['question_no']} (L{it['_ln']})"
        ch = it["choices"]
        if len(ch) != 4 or any(not c for c in ch) or len(set(ch)) != 4:
            errs.append(f"{tag}: choices invalid {ch}")
        if not 0 <= it["correct_index"] <= 3:
            errs.append(f"{tag}: answer out of range")
        qt = it["question_type"]
        p = it["prompt_jp"]
        if not p:
            errs.append(f"{tag}: empty prompt")
        if qt in ("kanji_reading", "orthography") or (qt == "paraphrase" and level not in KANA_LEVELS):
            if not it["target_text"]:
                errs.append(f"{tag}: missing [[target]]")
        if qt == "kanji_reading":
            if not KANJI.search(it["target_text"] or ""):
                errs.append(f"{tag}: kanji_reading target has no kanji")
            if not all(KANA_ONLY.match(c) for c in ch):
                errs.append(f"{tag}: kanji_reading choices must be kana")
        if qt == "orthography":
            if KANJI.search(it["target_text"] or ""):
                errs.append(f"{tag}: orthography target should be kana")
            if not all(KANJI.search(c) for c in ch):
                errs.append(f"{tag}: orthography choices need kanji")
        if qt in ("grammar_choice", "context_vocabulary", "word_formation") and "（　）" not in p:
            errs.append(f"{tag}: blank （　） missing")
        if qt == "sentence_composition" and (p.count("★") != 1 or p.count("＿＿") != 3):
            errs.append(f"{tag}: composition needs ★ + 3 ＿＿")
        if qt == "text_grammar":
            if not it["passage_jp"] or f"（{it['question_no']}）" not in it["passage_jp"]:
                errs.append(f"{tag}: passage blank （{it['question_no']}） missing")
        if it["section"] == "reading" and not it["passage_jp"]:
            errs.append(f"{tag}: reading without passage")
        key = norm(p) + "|" + "|".join(sorted(norm(c) for c in ch))
        if key in exam1_keys:
            errs.append(f"{tag}: duplicate of exam 1")
        prev = seen_global.get((level, key))
        if prev:
            errs.append(f"{tag}: duplicate of {prev}")
        seen_global[(level, key)] = f"exam{exam} {tag}"
        pk = norm(p)
        if len(pk) > 12 and qt not in ("text_grammar",) and it["section"] != "reading":
            prevp = seen_global.get((level, "p", pk))
            if prevp:
                errs.append(f"{tag}: same prompt as {prevp}")
            seen_global[(level, "p", pk)] = f"exam{exam} {tag}"
    out = []
    for it in rows:
        out.append({
          "level": level, "exam_no": exam, "section": it["section"], "session_no": st["sessions"][it["section"]],
          "mondai_no": it["mondai_no"], "question_no": it["question_no"], "display_question_no": it["question_no"],
          "question_type": it["question_type"], "instruction_jp": it["instruction_jp"], "prompt_jp": it["prompt_jp"],
          "choices": it["choices"], "correct_index": it["correct_index"], "passage_title": it["passage_title"],
          "passage_jp": it["passage_jp"], "target_text": it["target_text"], "target_occurrence": it["target_occurrence"],
          "status": "ready",
        })
    for (m, qt, n, nopt) in st["listening"]:
        for q in range(1, n + 1):
            ins = (LISTEN_INS_EASY if level in KANA_LEVELS else LISTEN_INS).get(qt) or LISTEN_INS[qt]
            out.append({
              "level": level, "exam_no": exam, "section": "listening", "session_no": st["sessions"]["listening"],
              "mondai_no": m, "question_no": q, "display_question_no": q, "question_type": qt,
              "instruction_jp": f"問題{m}　{ins}", "prompt_jp": "PENDING_CONTENT", "choices": [""] * nopt,
              "correct_index": 0, "passage_title": None, "passage_jp": None, "target_text": None,
              "target_occurrence": None, "status": "pending_content",
            })
    return level, exam, out, errs

def main():
    exam1 = json.loads((OUT / "exam1_keys.json").read_text()) if (OUT / "exam1_keys.json").exists() else {}
    seen = {}
    total_err = 0
    only = set(sys.argv[1:])
    for path in sorted(SRC.glob("N*-exam*.txt")):
        if only and path.stem not in only:
            continue
        lv = path.stem.split('-')[0]
        level, exam, rows, errs = build(path, set(exam1.get(lv, [])), seen)
        if errs:
            total_err += len(errs)
            print(f"== {path.stem}: {len(errs)} error(s)")
            for e in errs:
                print("  ", e)
            continue
        (OUT / f"{path.stem}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=0))
        ready = sum(r["status"] == "ready" for r in rows)
        print(f"OK {path.stem}: {ready} questions + {len(rows) - ready} listening slots")
    sys.exit(1 if total_err else 0)

if __name__ == "__main__":
    main()
