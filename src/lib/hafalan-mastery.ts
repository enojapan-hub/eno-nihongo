export type MasteryAspect = 'meaning' | 'reading' | 'usage' | 'function' | 'context';
export type MasteryKind = 'kanji' | 'vocabulary' | 'grammar';

export type MasteryCard = {
  id: string;
  kind: MasteryKind;
  front: string;
  back: string;
  sub?: string;
  example?: string;
  aspect: MasteryAspect;
};

type ReadingValue = string | string[] | null;
type KanjiSource = { id: string; character?: string | null; meaning_id?: string | null; onyomi?: ReadingValue; kunyomi?: ReadingValue };
type VocabSource = { id: string; term?: string | null; meaning_id?: string | null; reading?: string | null; part_of_speech?: string | null; example?: string };
type GrammarSource = { id: string; pattern?: string | null; meaning_id?: string | null; structure?: string | null; example?: string };

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const cleanReading = (value: ReadingValue | undefined) => Array.isArray(value) ? value.map(clean).filter(Boolean).join('、') : clean(value);
const joinReadings = (on?: ReadingValue, kun?: ReadingValue) => {
  const onyomi = cleanReading(on), kunyomi = cleanReading(kun);
  return [onyomi && `On’yomi: ${onyomi}`, kunyomi && `Kun’yomi: ${kunyomi}`].filter(Boolean).join(' · ');
};
const cloze = (sentence: string, answer: string) => sentence.includes(answer) ? sentence.split(answer).join('＿＿＿') : '';

export function buildKanjiMasteryCards(item: KanjiSource): MasteryCard[] {
  const character = clean(item.character), meaning = clean(item.meaning_id), reading = joinReadings(item.onyomi, item.kunyomi);
  const cards: MasteryCard[] = [];
  if (character && meaning) cards.push({ id: item.id, kind: 'kanji', front: character, back: meaning, sub: reading || undefined, aspect: 'meaning' });
  if (character && reading) cards.push({ id: item.id, kind: 'kanji', front: character, back: reading, sub: meaning || undefined, aspect: 'reading' });
  return cards;
}

export function buildVocabularyMasteryCards(item: VocabSource): MasteryCard[] {
  const term = clean(item.term), meaning = clean(item.meaning_id), reading = clean(item.reading), example = clean(item.example);
  const cards: MasteryCard[] = [];
  if (term && meaning) cards.push({ id: item.id, kind: 'vocabulary', front: term, back: meaning, sub: reading, aspect: 'meaning' });
  if (term && reading) cards.push({ id: item.id, kind: 'vocabulary', front: term, back: reading, sub: meaning, aspect: 'reading' });
  const usagePrompt = term && example ? cloze(example, term) : '';
  if (usagePrompt) cards.push({ id: item.id, kind: 'vocabulary', front: usagePrompt, back: term, sub: meaning, example, aspect: 'usage' });
  return cards;
}

export function buildGrammarMasteryCards(item: GrammarSource): MasteryCard[] {
  const pattern = clean(item.pattern), meaning = clean(item.meaning_id), structure = clean(item.structure), example = clean(item.example);
  const cards: MasteryCard[] = [];
  if (pattern && (meaning || structure)) cards.push({ id: item.id, kind: 'grammar', front: pattern, back: meaning || structure, sub: structure, example, aspect: 'function' });
  const contextPrompt = pattern && example ? cloze(example, pattern) : '';
  if (contextPrompt) cards.push({ id: item.id, kind: 'grammar', front: contextPrompt, back: pattern, sub: meaning || structure, example, aspect: 'context' });
  return cards;
}

export const masteryAspectLabel: Record<MasteryAspect, string> = {
  meaning: 'Arti',
  reading: 'Bacaan',
  usage: 'Penggunaan',
  function: 'Fungsi',
  context: 'Konteks',
};
