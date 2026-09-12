import type { Level } from "@/lib/learn-queries";

export type SimulationSection = "vocabulary" | "grammar" | "reading" | "listening";
export type SimulationSession = {
  id: string;
  labelJp: string;
  sections: SimulationSection[];
  minutes: number;
};

/**
 * ENO NIHONGO full-simulation session model aligned to the official 2026 JLPT
 * test-section timing. Keep full-session timing authoritative here so the
 * runner never falls back to obsolete pre-2020 N4/N5 durations.
 */
export const jlptSessions: Record<Level, SimulationSession[]> = {
  N5: [
    { id: "language-vocabulary", labelJp: "言語知識（文字・語彙）", sections: ["vocabulary"], minutes: 20 },
    { id: "grammar-reading", labelJp: "言語知識（文法）・読解", sections: ["grammar", "reading"], minutes: 40 },
    { id: "listening", labelJp: "聴解", sections: ["listening"], minutes: 30 },
  ],
  N4: [
    { id: "language-vocabulary", labelJp: "言語知識（文字・語彙）", sections: ["vocabulary"], minutes: 25 },
    { id: "grammar-reading", labelJp: "言語知識（文法）・読解", sections: ["grammar", "reading"], minutes: 55 },
    { id: "listening", labelJp: "聴解", sections: ["listening"], minutes: 35 },
  ],
  N3: [
    { id: "language-vocabulary", labelJp: "言語知識（文字・語彙）", sections: ["vocabulary"], minutes: 30 },
    { id: "grammar-reading", labelJp: "言語知識（文法）・読解", sections: ["grammar", "reading"], minutes: 70 },
    { id: "listening", labelJp: "聴解", sections: ["listening"], minutes: 40 },
  ],
  N2: [
    { id: "language-reading", labelJp: "言語知識（文字・語彙・文法）・読解", sections: ["vocabulary", "grammar", "reading"], minutes: 105 },
    { id: "listening", labelJp: "聴解", sections: ["listening"], minutes: 50 },
  ],
  N1: [
    { id: "language-reading", labelJp: "言語知識（文字・語彙・文法）・読解", sections: ["vocabulary", "grammar", "reading"], minutes: 110 },
    { id: "listening", labelJp: "聴解", sections: ["listening"], minutes: 55 },
  ],
};

export const sectionLabels: Record<SimulationSection, string> = {
  vocabulary: "文字・語彙",
  grammar: "文法",
  reading: "読解",
  listening: "聴解",
};
