import { supabase } from "@/integrations/supabase/client";
import { buildJlptAudioSegmentUrl, getJlptAudioSegment } from "@/lib/jlpt-audio-catalog";
import { getDriveFallback } from "@/lib/jlpt-drive-fallback";
import type { Level, RunnerQuestion } from "@/lib/learn-queries";

export type SimulationGroup = "vocabulary" | "grammar_reading" | "language_reading" | "listening";

export type SimulationQuestion = RunnerQuestion & {
  skill: string | null;
  questionType: string | null;
  audioUrl: string | null;
  audioStartSeconds: number | null;
  audioEndSeconds: number | null;
  audioMondai: 1 | 2 | 3 | 4 | null;
  transcriptJp: string | null;
  listeningId: string | null;
  listeningTitle: string | null;
  listeningSortOrder: number | null;
  persistAnswer: boolean;
};

const skillsByGroup: Record<SimulationGroup, string[]> = {
  vocabulary: ["vocabulary", "kanji"],
  grammar_reading: ["grammar", "reading"],
  language_reading: ["vocabulary", "kanji", "grammar", "reading"],
  listening: ["listening"],
};

const targets: Record<Level, Record<SimulationGroup, number>> = {
  N5: { vocabulary: 20, grammar_reading: 40, language_reading: 40, listening: 24 },
  N4: { vocabulary: 25, grammar_reading: 55, language_reading: 55, listening: 28 },
  N3: { vocabulary: 30, grammar_reading: 70, language_reading: 70, listening: 28 },
  N2: { vocabulary: 32, grammar_reading: 70, language_reading: 70, listening: 30 },
  N1: { vocabulary: 35, grammar_reading: 75, language_reading: 75, listening: 30 },
};

function looksLikeLegacyEnglishPrompt(text: string) {
  return /\b(what is|which|choose|select|meaning of|reading of|correct answer|best answer)\b/i.test(text);
}

function normalize(rows: unknown[]): SimulationQuestion[] {
  return (rows as Array<Record<string, unknown>>)
    .map((q) => {
      const listening =
        q.listening && typeof q.listening === "object"
          ? (q.listening as Record<string, unknown>)
          : null;
      const localizedChoices = Array.isArray(q.choices_id) ? q.choices_id.map(String) : [];
      const localizedPrompt = typeof q.prompt_id === "string" ? q.prompt_id.trim() : "";
      const hasLocalizedQuestion = localizedPrompt.length > 0 && localizedChoices.length === 4 && localizedChoices.every(Boolean);
      const sourcePrompt = String(q.prompt ?? "");
      const skill = typeof q.skill === "string" ? q.skill : null;
      const isLegacyEnglishLexical = (skill === "kanji" || skill === "vocabulary") && !hasLocalizedQuestion && looksLikeLegacyEnglishPrompt(sourcePrompt);

      return {
        id: String(q.id),
        prompt: hasLocalizedQuestion ? localizedPrompt : sourcePrompt,
        prompt_note: typeof q.prompt_note === "string" ? q.prompt_note : null,
        choices: hasLocalizedQuestion ? localizedChoices : Array.isArray(q.choices) ? q.choices.map(String) : [],
        correct_index: Number(q.correct_index),
        explanation_id: typeof q.explanation_id === "string" ? q.explanation_id : null,
        skill,
        questionType: typeof q.question_type === "string" ? q.question_type : null,
        audioUrl:
          listening && typeof listening.audio_url === "string" && listening.audio_url.trim()
            ? listening.audio_url
            : null,
        audioStartSeconds: null,
        audioEndSeconds: null,
        audioMondai: null,
        transcriptJp:
          listening && typeof listening.transcript_jp === "string"
            ? listening.transcript_jp
            : null,
        listeningId:
          typeof q.listening_id === "string" && q.listening_id.trim() ? q.listening_id : null,
        listeningTitle:
          listening && typeof listening.title === "string" ? listening.title : null,
        listeningSortOrder:
          listening && typeof listening.sort_order === "number" ? listening.sort_order : null,
        persistAnswer: true,
        _skipLegacyEnglish: isLegacyEnglishLexical,
      } as SimulationQuestion & { _skipLegacyEnglish: boolean };
    })
    .filter(
      (q) =>
        !q._skipLegacyEnglish &&
        q.prompt.trim() &&
        q.choices.length === 4 &&
        q.correct_index >= 0 &&
        q.correct_index < 4,
    )
    .map(({ _skipLegacyEnglish: _ignored, ...q }) => q);
}

function normalizeDriveFallback(level: Level, skills: string[]): SimulationQuestion[] {
  return getDriveFallback(level, skills).map((q) => ({
    ...q,
    audioStartSeconds: null,
    audioEndSeconds: null,
    audioMondai: null,
    listeningId: null,
    listeningTitle: null,
    listeningSortOrder: null,
    persistAnswer: false,
  }));
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function fillFromDrive(
  level: Level,
  skills: string[],
  databaseQuestions: SimulationQuestion[],
  target: number,
): SimulationQuestion[] {
  if (databaseQuestions.length >= target) return databaseQuestions.slice(0, target);
  const existing = new Set(databaseQuestions.map((q) => q.id));
  const fallback = shuffle(normalizeDriveFallback(level, skills)).filter((q) => !existing.has(q.id));
  return [...databaseQuestions, ...fallback].slice(0, target);
}

async function fetchSkill(level: Level, skill: string, limit: number) {
  const result = await supabase
    .from("questions")
    .select(
      "id, prompt, prompt_id, prompt_note, choices, choices_id, correct_index, explanation_id, level, skill, question_type, listening_id, listening:listening_id (id, title, audio_url, transcript_jp, sort_order)",
    )
    .eq("is_published", true)
    .eq("level", level)
    .eq("skill", skill)
    .limit(limit);

  if (result.error) throw new Error(result.error.message);
  return normalize(result.data ?? []);
}

function groupListeningQuestions(items: SimulationQuestion[], target: number): SimulationQuestion[] {
  const byClip = new Map<string, SimulationQuestion[]>();
  const ungrouped: SimulationQuestion[] = [];

  for (const question of items) {
    if (!question.listeningId) {
      ungrouped.push(question);
      continue;
    }
    const existing = byClip.get(question.listeningId) ?? [];
    existing.push(question);
    byClip.set(question.listeningId, existing);
  }

  const groups = [...byClip.values()]
    .map((group) =>
      [...group].sort((a, b) => {
        const typeA = a.questionType ?? "";
        const typeB = b.questionType ?? "";
        return typeA.localeCompare(typeB) || a.id.localeCompare(b.id);
      }),
    )
    .sort((a, b) => {
      const sortA = a[0]?.listeningSortOrder ?? Number.MAX_SAFE_INTEGER;
      const sortB = b[0]?.listeningSortOrder ?? Number.MAX_SAFE_INTEGER;
      if (sortA !== sortB) return sortA - sortB;
      return (a[0]?.listeningTitle ?? "").localeCompare(b[0]?.listeningTitle ?? "");
    });

  const flattened: SimulationQuestion[] = [];
  for (const group of groups) {
    for (const question of group) {
      if (flattened.length >= target) break;
      flattened.push(question);
    }
    if (flattened.length >= target) break;
  }

  if (flattened.length < target && ungrouped.length) {
    flattened.push(...shuffle(ungrouped).slice(0, target - flattened.length));
  }

  return flattened.slice(0, target);
}

function attachCatalogAudio(level: Level, questions: SimulationQuestion[]): SimulationQuestion[] {
  return questions.map((question) => {
    if (question.audioUrl) return question;
    const segment = getJlptAudioSegment(level, question.questionType, 2024);
    if (!segment) return question;

    return {
      ...question,
      audioUrl: buildJlptAudioSegmentUrl(level, question.questionType, 2024),
      audioStartSeconds: segment.startSeconds,
      audioEndSeconds: segment.endSeconds,
      audioMondai: segment.mondai,
    };
  });
}

export async function fetchSimulationQuestionSet(
  level: Level,
  group: SimulationGroup,
): Promise<SimulationQuestion[]> {
  const target = targets[level][group];
  const skills = skillsByGroup[group];

  if (group === "vocabulary") {
    const vocab = await fetchSkill(level, "vocabulary", Math.ceil(target * 0.8));
    const kanji = await fetchSkill(level, "kanji", Math.ceil(target * 0.2));
    return fillFromDrive(level, skills, shuffle([...vocab, ...kanji]), target);
  }

  if (group === "grammar_reading") {
    const grammarTarget = Math.ceil(target * 0.42);
    const readingTarget = target - grammarTarget;
    const grammar = await fetchSkill(level, "grammar", grammarTarget);
    const reading = await fetchSkill(level, "reading", readingTarget);
    return fillFromDrive(level, skills, shuffle([...grammar, ...reading]), target);
  }

  if (group === "language_reading") {
    const vocabularyTarget = Math.ceil(target * 0.28);
    const grammarTarget = Math.ceil(target * 0.24);
    const readingTarget = target - vocabularyTarget - grammarTarget;

    const [vocabulary, kanji, grammar, reading] = await Promise.all([
      fetchSkill(level, "vocabulary", vocabularyTarget),
      fetchSkill(level, "kanji", Math.max(2, Math.ceil(vocabularyTarget * 0.25))),
      fetchSkill(level, "grammar", grammarTarget),
      fetchSkill(level, "reading", readingTarget),
    ]);

    return fillFromDrive(level, skills, shuffle([...vocabulary, ...kanji, ...grammar, ...reading]), target);
  }

  const listening = await Promise.all(
    skills.map((skill) => fetchSkill(level, skill, Math.max(target * 3, target))),
  );

  const withPlayableSource = listening.flat().filter((question) => {
    if (question.audioUrl || question.transcriptJp) return true;
    return Boolean(getJlptAudioSegment(level, question.questionType, 2024));
  });

  return attachCatalogAudio(level, groupListeningQuestions(withPlayableSource, target));
}

export function getSimulationTarget(level: Level, group: SimulationGroup) {
  return targets[level][group];
}
