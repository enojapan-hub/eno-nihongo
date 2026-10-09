import { describe, expect, it } from "vitest";
import {
  classifyVocabularyPartOfSpeech,
  formatVocabularyClass,
  VOCAB_PRIMARY_CATEGORIES,
  VOCAB_SUBCATEGORIES,
} from "@/lib/vocabulary-taxonomy";

describe("vocabulary taxonomy", () => {
  it("keeps the same ten primary categories for every level", () => {
    expect(VOCAB_PRIMARY_CATEGORIES).toHaveLength(10);
    expect(VOCAB_PRIMARY_CATEGORIES.map((x) => x.label)).toEqual([
      "Kata Benda",
      "Kata Kerja",
      "Kata Sifat い",
      "Kata Sifat な",
      "Kata Keterangan",
      "Kata Ganti",
      "Kata Sambung",
      "Kata Seru",
      "Ungkapan",
      "Lainnya",
    ]);
    expect(VOCAB_PRIMARY_CATEGORIES.map((x) => x.labelJa)).toEqual([
      "名詞",
      "動詞",
      "い形容詞",
      "な形容詞",
      "副詞",
      "代名詞",
      "接続詞",
      "感動詞",
      "表現",
      "その他",
    ]);
  });

  it("nests audited semantic groups under Kata Benda", () => {
    expect(VOCAB_SUBCATEGORIES["kata-benda"].map((x) => x.slug)).toEqual([
      "warna",
      "bilangan-penghitung",
      "alat-tulis",
    ]);
    expect(VOCAB_SUBCATEGORIES["kata-benda"].map((x) => x.labelJa)).toEqual(["色", "数・助数詞", "文房具"]);
  });

  it.each([
    ["Meishi / Kata Benda", ["kata-benda"]],
    ["Doushi / Kata Kerja", ["kata-kerja"]],
    ["I-keiyoushi / Kata Sifat い", ["kata-sifat-i"]],
    ["Kata sifat-na", ["kata-sifat-na"]],
    ["Fukushi / Kata Keterangan", ["kata-keterangan"]],
    ["Daimeishi / Kata Ganti", ["kata-ganti"]],
    ["Setsuzokushi / Kata Sambung", ["kata-sambung"]],
    ["Seruan", ["kata-seru"]],
    ["Ungkapan / Frasa", ["ungkapan"]],
    ["Partikel Akhir", ["lainnya"]],
    ["Kata Bantu Bilangan", ["kata-benda"]],
  ])("%s dinormalisasi", (raw, expected) => {
    expect(classifyVocabularyPartOfSpeech(raw).categories).toEqual(expected);
  });

  it("preserves multiple grammatical functions instead of inventing a combined category", () => {
    expect(classifyVocabularyPartOfSpeech("Kata Benda / Kata Sifat な").categories).toEqual([
      "kata-benda",
      "kata-sifat-na",
    ]);
  });

  it("keeps non-primary information as smaller detail text", () => {
    expect(formatVocabularyClass("kata kerja intransitif; kelompok 1")).toEqual({
      labels: ["Kata Kerja"],
      details: ["intransitif", "kelompok 1"],
    });
  });
});
