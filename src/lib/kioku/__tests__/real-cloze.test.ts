import { describe, expect, it } from "vitest";
import { blankOut, sentenceOrderParts, stemOf } from "../session";

// 40 real vocabulary examples (term, first example sentence) sampled from the production dataset.
const REAL: Array<[string, string]> = [
  ["サイズ直し", "このズボンのサイズ直しをお願いします。"],
  ["まっすぐ", "まっすぐ行ってください。"],
  ["当時", "当時、私はまだ大学生でした。"],
  ["一瞬", "一瞬 目 を 閉じました。"],
  ["倒れます", "地震で木が倒れました。"],
  ["特徴", "この町の特徴は古い建物が多いことです。"],
  ["積みます", "トラックに荷物を積みます。"],
  ["警察", "事故を警察に知らせました。"],
  ["和食", "私は 和食 が 好き です。"],
  ["邪魔", "荷物が通路の邪魔になっています。"],
  ["水が凍る", "寒くて、水が凍りました。"],
  ["手をつなぐ", "子どもと手をつないで歩きます。"],
  ["返事", "メール の 返事 を 書きました。"],
  ["ほっとする", "試験 が 終わって ほっとしました。"],
  ["咲く", "春になると、公園に桜の花がたくさん咲きます。"],
  ["助手", "先生の助手として研究を手伝っています。"],
  ["助手席", "私は助手席に座りました。"],
  ["乗り過ごす", "居眠りして 駅 を 乗り過ごしました。"],
  ["流れる", "町の中心を大きな川が流れています。"],
  ["感動する", "その映画を見て感動しました。"],
  ["相談する", "困ったときは先生に相談してください。"],
  ["調べます", "辞書で言葉を調べます。"],
  ["食事", "家族と一緒に夕食の食事をしました。"],
  ["覚えます", "毎日新しい漢字を覚えます。"],
  ["あきらめます", "夢をあきらめません。"],
  ["積もる", "昨夜から雪が二十センチ積もりました。"],
  ["減る", "貯金 が 少しずつ 減って います。"],
  ["まとめる", "会議 の 内容 を まとめて ください。"],
  ["置きます", "本を机の上に置きます。"],
  ["言い直す", "分かりにくかったので、もう一度言い直しました。"],
  ["計算します", "電卓で金額を計算します。"],
  ["元", "この建物は元は学校でした。"],
  ["都", "京都は長い間、日本の都でした。"],
  ["部屋", "私の部屋は二階です。"],
  ["原", "広い原に花がたくさん咲いています。"],
  ["会員", "ジムの会員になりました。"],
  ["国家", "国家には国民の安全を守る責任があります。"],
  ["笑い", "彼の話を聞いて笑いが起こりました。"],
  ["満ちる", "会場は期待に満ちていました。"],
  ["貯える", "非常時のために食料を貯えます。"],
];

describe("cloze on real data", () => {
  it("never damages the Japanese or leaves the target behind", () => {
    let produced = 0;
    for (const [term, ja] of REAL) {
      let needle = term;
      let out = blankOut(ja, term, false);
      if (!out) {
        needle = stemOf(term);
        out = needle !== term ? blankOut(ja, needle, true) : null;
      }
      if (!out) continue; // rejected safely (falls back to a non-cloze exercise)
      produced++;
      expect(out).not.toContain(needle);
      expect(out.split("＿＿").join(needle)).toBe(ja);
    }
    expect(produced).toBeGreaterThan(25);
  });
});


describe("sentence ordering on source data", () => {
  it("only accepts explicit source chunks and reconstructs the sentence exactly", () => {
    expect(sentenceOrderParts("毎日 日本語 を 勉強します。")).toEqual([
      "毎日",
      "日本語",
      "を",
      "勉強します。",
    ]);
    expect(sentenceOrderParts("毎日日本語を勉強します。")).toBeNull();
    expect(sentenceOrderParts("私 は 私 が 好き")).toBeNull();
    const source = "一瞬 目 を 閉じました。";
    expect(sentenceOrderParts(source)?.join(" ")).toBe(source);
  });
});
