export type JlptAudioSection = {
  mondai: 1 | 2 | 3 | 4;
  questionCount: number | null;
  startSeconds: number;
  endSeconds: number;
  boundarySource: "silence-analysis" | "manual";
};

export type JlptAudioSource = {
  level: "N5" | "N4" | "N3" | "N2" | "N1";
  year: number;
  driveFileId: string;
  fileName: string;
  durationSeconds: number;
  sourceBookletFileId: string;
  publicUrl: string | null;
  sections: JlptAudioSection[];
};

export type JlptAudioSegment = {
  url: string;
  startSeconds: number;
  endSeconds: number;
  mondai: 1 | 2 | 3 | 4;
};

// N5 2024 source pair verified from the user's Google Drive.
// The source MP3 has now been copied to the public Supabase bucket used by
// JLPT simulation assets. Section boundaries were derived from the long answer
// pauses in the source MP3 and cross-checked against the booklet structure:
// Mondai 1 = 7 questions, Mondai 2 = 6, Mondai 3 = 5,
// Mondai 4 = rapid-response/no picture section.
// Public URL intentionally lives in this catalog so the simulation runner can
// use source audio without depending on a private Google Drive streaming URL.
export const JLPT_AUDIO_CATALOG: JlptAudioSource[] = [
  {
    level: "N5",
    year: 2024,
    driveFileId: "1sjTiG9I--2TZ1scNHtZGP5XfN1HHXaj7",
    fileName: "Audio N5.mp3",
    durationSeconds: 1195.651,
    sourceBookletFileId: "17gzfqKj5-WB53V2rP-ln1NsSRnNcWrRj",
    publicUrl:
      "https://upxtqsvgppvqpbrjoitz.supabase.co/storage/v1/object/public/jlpt-simulation-audio/N5/2024/Audio%20N5.mp3",
    sections: [
      { mondai: 1, questionCount: 7, startSeconds: 0, endSeconds: 399.276, boundarySource: "silence-analysis" },
      { mondai: 2, questionCount: 6, startSeconds: 399.276, endSeconds: 840.272, boundarySource: "silence-analysis" },
      { mondai: 3, questionCount: 5, startSeconds: 840.272, endSeconds: 1024.274, boundarySource: "silence-analysis" },
      { mondai: 4, questionCount: null, startSeconds: 1024.274, endSeconds: 1195.651, boundarySource: "silence-analysis" },
    ],
  },
];

export function getJlptAudioSource(level: JlptAudioSource["level"], year = 2024) {
  return JLPT_AUDIO_CATALOG.find((source) => source.level === level && source.year === year) ?? null;
}

export function getJlptAudioSectionForQuestionType(
  level: JlptAudioSource["level"],
  questionType: string | null,
  year = 2024,
) {
  if (!questionType) return null;

  // JLPT N5 2024 listening structure:
  // 1 課題理解, 2 ポイント理解, 3 発話表現, 4 即時応答.
  const n5MondaiByType: Record<string, 1 | 2 | 3 | 4> = {
    task_based: 1,
    point: 2,
    expression: 3,
    quick_response: 4,
  };

  if (level !== "N5") return null;
  const mondai = n5MondaiByType[questionType];
  if (!mondai) return null;

  return getJlptAudioSource(level, year)?.sections.find((section) => section.mondai === mondai) ?? null;
}

export function getJlptAudioSegment(
  level: JlptAudioSource["level"],
  questionType: string | null,
  year = 2024,
): JlptAudioSegment | null {
  const source = getJlptAudioSource(level, year);
  const section = getJlptAudioSectionForQuestionType(level, questionType, year);
  if (!source?.publicUrl || !section) return null;

  return {
    url: source.publicUrl,
    startSeconds: section.startSeconds,
    endSeconds: section.endSeconds,
    mondai: section.mondai,
  };
}

export function buildJlptAudioSegmentUrl(
  level: JlptAudioSource["level"],
  questionType: string | null,
  year = 2024,
) {
  const segment = getJlptAudioSegment(level, questionType, year);
  if (!segment) return null;

  return `${segment.url}#t=${segment.startSeconds},${segment.endSeconds}`;
}
