import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { toPracticeWords } from "@/components/learn/WordReadingPractice";

const row = (term: string, romaji: string | null, meaning: string | null = "arti", id = term) => ({
  id,
  term,
  romaji,
  meaning_id: meaning,
});

describe("Latihan Baca Kata word pool", () => {
  it("keeps words whose stored reading matches the kana", () => {
    const words = toPracticeWords([row("カード", "kaado", "kartu"), row("さくら", "sakura", "bunga sakura")]);
    expect(words.map((w) => w.romaji)).toEqual(["kaado", "sakura"]);
  });

  it("drops mis-entered readings so a wrong answer can never be marked correct", () => {
    const words = toPracticeWords([
      row("ボーナス", "bonasu"),
      row("ナンバー", "nanba"),
      row("チップ", "chipu"),
      row("あっ", "a"),
    ]);
    expect(words).toEqual([]);
  });

  it("drops rows without a meaning or reading, and long phrases", () => {
    const words = toPracticeWords([
      row("ねこ", "neko", ""),
      row("いぬ", null),
      row("していらっしゃいます", "shiteirasshaimasu"),
    ]);
    expect(words).toEqual([]);
  });

  it("merges homonyms into one entry with every published meaning", () => {
    const words = toPracticeWords([
      row("はし", "hashi", "jembatan", "a"),
      row("はし", "hashi", "sumpit", "b"),
    ]);
    expect(words).toHaveLength(1);
    expect(words[0]?.meaning).toBe("jembatan / sumpit");
  });
});
