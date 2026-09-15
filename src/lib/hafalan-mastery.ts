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

type KanjiSource = { id: string; character?: string | null; meaning_id?: string | null; onyomi?: string | null; kunyomi?: string | null };
type VocabSource = { id: string; term?: string | null; meaning_id?: string | null; reading?: string | null; part_of_speech?: string | null; example?: string };
type GrammarSource = { id: string; pattern?: string | null; meaning_id?: string | null; structure?: string | null; example?: string };

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const joinReadings = (on?: string | null, kun?: string | null) => [clean(on) && `On: ${clean(on)}`, clean(kun) && `Kun: ${clean(kun)}`].filter(Boolean).join(' · ');

export function buildKanjiMasteryCards(item: KanjiSource): MasteryCard[] {
  const character = clean(item.character), meaning = clean(item.meaning_id), reading = joinReadings(item.onyomi, item.kunyomi);
  const cards: MasteryCard[] = [];
  if (character && meaning) cards.push({ id: item.id, kind: 'kanji', front: character, back: meaning, aspect: 'meaning' });
  if (character && reading) cards.push({ id: item.id, kind: 'kanji', front: character, back: reading, aspect: 'reading' });
  return cards;
}

export function buildVocabularyMasteryCards(item: VocabSource): MasteryCard[] {
  const term = clean(item.term), meaning = clean(item.meaning_id), reading = clean(item.reading), example = clean(item.example);
  const cards: MasteryCard[] = [];
  if (term && meaning) cards.push({ id: item.id, kind: 'vocabulary', front: term, back: meaning, sub: reading, aspect: 'meaning' });
  if (term && reading) cards.push({ id: item.id, kind: 'vocabulary', front: term, back: reading, sub: meaning, aspect: 'reading' });
  if (term && example) cards.push({ id: item.id, kind: 'vocabulary', front: example, back: term, sub: meaning, example, aspect: 'usage' });
  return cards;
}

export function buildGrammarMasteryCards(item: GrammarSource): MasteryCard[] {
  const pattern = clean(item.pattern), meaning = clean(item.meaning_id), structure = clean(item.structure), example = clean(item.example);
  const cards: MasteryCard[] = [];
  if (pattern && (meaning || structure)) cards.push({ id: item.id, kind: 'grammar', front: pattern, back: meaning || structure, sub: structure, example, aspect: 'function' });
  if (pattern && example) cards.push({ id: item.id, kind: 'grammar', front: example, back: pattern, sub: meaning || structure, example, aspect: 'context' });
  return cards;
}

export const masteryAspectLabel: Record<MasteryAspect, string> = {
  meaning: 'Arti',
  reading: 'Bacaan',
  usage: 'Penggunaan',
  function: 'Fungsi',
  context: 'Konteks',
};
