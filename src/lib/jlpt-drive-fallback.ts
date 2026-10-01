import type { Level, RunnerQuestion } from "@/lib/learn-queries";

export type DriveQuestion = RunnerQuestion & { skill: string; questionType: string; audioUrl: string | null; transcriptJp: string | null };

// Verified from the user-provided N5 2024 Drive booklet. This is a resilient
// fallback while the same corpus is normalized into Supabase.
const N5: DriveQuestion[] = [
  {id:"55000000-0000-4000-8000-000000000001",prompt:"あの先生は わかいです。『先生』は ひらがなで どうかきますか。",prompt_note:null,choices:["せんせえ","せんせい","せんせん","せんせ"],correct_index:1,explanation_id:"先生（せんせい） berarti guru.",skill:"kanji",questionType:"moji_yomi",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000002",prompt:"あした えいがかんは 休みです。『休み』は ひらがなで どうかきますか。",prompt_note:null,choices:["やつみ","やづみ","やすみ","やずみ"],correct_index:2,explanation_id:"休み dibaca やすみ, berarti libur/istirahat.",skill:"kanji",questionType:"moji_yomi",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000003",prompt:"このセーターは 二千九百えんでした。『二千九百』は どうよみますか。",prompt_note:null,choices:["にっせんきゅうひゃく","にっせんくうひゃく","にせんきゅうびゃく","にせんきゅうひゃく"],correct_index:3,explanation_id:"二千九百 dibaca にせんきゅうひゃく (2.900).",skill:"kanji",questionType:"moji_yomi",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000004",prompt:"すみません、お金を 忘れました。『お金』は どうよみますか。",prompt_note:null,choices:["おかね","おかぬ","おがね","おがぬ"],correct_index:0,explanation_id:"お金 dibaca おかね, berarti uang.",skill:"kanji",questionType:"moji_yomi",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000005",prompt:"毎日 こうえんを さんぽします。『毎日』は どうよみますか。",prompt_note:null,choices:["まえにち","まいにち","めえにち","めいにち"],correct_index:1,explanation_id:"毎日 dibaca まいにち, berarti setiap hari.",skill:"kanji",questionType:"moji_yomi",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000006",prompt:"右がわに としょかんが あります。『右』は どうよみますか。",prompt_note:null,choices:["みぎ","みき","ひたり","ひだり"],correct_index:0,explanation_id:"右 dibaca みぎ, berarti kanan.",skill:"kanji",questionType:"moji_yomi",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000007",prompt:"この しごとは 時間が かかります。『時間』は どうよみますか。",prompt_note:null,choices:["しがん","じっかん","じがん","じかん"],correct_index:3,explanation_id:"時間 dibaca じかん, berarti waktu/durasi.",skill:"kanji",questionType:"moji_yomi",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000008",prompt:"はしの うえで 電車が とまりました。『電車』は どうよみますか。",prompt_note:null,choices:["でんしゃ","てんしゃ","てんじゃ","でんじゃ"],correct_index:0,explanation_id:"電車 dibaca でんしゃ, berarti kereta listrik.",skill:"kanji",questionType:"moji_yomi",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000009",prompt:"この なかで いちばん 安いのは どれですか。『安い』は どうよみますか。",prompt_note:null,choices:["たかい","はやい","やすい","ちいさい"],correct_index:2,explanation_id:"安い dibaca やすい, berarti murah.",skill:"kanji",questionType:"moji_yomi",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000010",prompt:"あねに こどもが 生まれました。『生まれました』は どうよみますか。",prompt_note:null,choices:["おまれました","うまれました","ゆまれました","いまれました"],correct_index:1,explanation_id:"生まれました dibaca うまれました, berarti telah lahir.",skill:"kanji",questionType:"moji_yomi",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000011",prompt:"タクシーを（ ）ください。",prompt_note:null,choices:["のって","よんで","とって","あって"],correct_index:1,explanation_id:"タクシーを呼んでください berarti tolong panggil taksi.",skill:"vocabulary",questionType:"context_vocab",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000012",prompt:"いもうとは あかい ぼうしを（ ）。",prompt_note:null,choices:["とっています","きています","かかっています","かぶっています"],correct_index:3,explanation_id:"Topi dipakai dengan kata kerja かぶる, sehingga bentuknya かぶっています.",skill:"vocabulary",questionType:"context_vocab",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000013",prompt:"『さようなら。（ ）あした。』",prompt_note:null,choices:["もう","どうも","また","もっと"],correct_index:2,explanation_id:"またあした berarti sampai jumpa besok.",skill:"vocabulary",questionType:"context_vocab",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000014",prompt:"めが わるいですから、（ ）を かけます。",prompt_note:null,choices:["ペン","コート","ぼうし","めがね"],correct_index:3,explanation_id:"めがねをかけます berarti memakai kacamata.",skill:"vocabulary",questionType:"context_vocab",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000015",prompt:"わたしは あさ シャワーを（ ）。",prompt_note:null,choices:["はいります","あびます","いれます","たべます"],correct_index:1,explanation_id:"シャワーを浴びます adalah ungkapan untuk mandi dengan shower.",skill:"vocabulary",questionType:"context_vocab",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000016",prompt:"（ ）にほんごの べんきょうを しましたか。",prompt_note:null,choices:["どのくらい","いくつ","いかが","どちらか"],correct_index:0,explanation_id:"どのくらい menanyakan berapa lama/seberapa banyak durasi belajar.",skill:"vocabulary",questionType:"context_vocab",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000017",prompt:"はしを（ ）、かいものに いきます。",prompt_note:null,choices:["とって","わたって","いって","のぼって"],correct_index:1,explanation_id:"橋を渡る berarti menyeberangi jembatan.",skill:"vocabulary",questionType:"context_vocab",audioUrl:null,transcriptJp:null},
  {id:"55000000-0000-4000-8000-000000000018",prompt:"あしたは いい てんきでしょう。だいたい おなじ いみは どれですか。",prompt_note:null,choices:["あしたは あめが ふるでしょう。","あしたは くもりでしょう。","あしたは ゆきでしょう。","あしたは はれでしょう。"],correct_index:3,explanation_id:"いい天気 dalam konteks ini paling sesuai dengan 晴れ, cuaca cerah.",skill:"vocabulary",questionType:"paraphrase",audioUrl:null,transcriptJp:null},
];

export function getDriveFallback(level: Level, skills?: string[]): DriveQuestion[] {
  if (level !== "N5") return [];
  return N5.filter((q) => !skills?.length || skills.includes(q.skill));
}
