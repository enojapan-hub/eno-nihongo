/** Position of `current` within the questions that share its passage (same section, mondai and text). */
export function passagePosition<
  T extends { id: string; section?: string; mondai_no: number; passage_jp?: string | null },
>(questions: T[], current: T) {
  const same = questions.filter(
    (x) =>
      x.section === current.section &&
      x.mondai_no === current.mondai_no &&
      x.passage_jp === current.passage_jp,
  );
  return { index: same.findIndex((x) => x.id === current.id) + 1, total: same.length };
}
