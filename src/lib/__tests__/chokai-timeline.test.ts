import { describe, expect, it } from "vitest";
import {
  activePosition,
  forwardOnly,
  isValidTimeline,
  parseTimeline,
  readChokaiProgress,
  writeChokaiProgress,
} from "../chokai-timeline";

const t = [
  { q: 1, start: 5, end: 20 },
  { q: 2, start: 25, end: 40 },
  { q: 3, start: 45, end: 60 },
];

describe("Chōkai timeline (full-session audio)", () => {
  it("parses only well-formed entries and never guesses", () => {
    expect(parseTimeline(t)).toEqual(t);
    expect(parseTimeline(null)).toBeNull();
    expect(parseTimeline([])).toBeNull();
    expect(parseTimeline([{ q: 1, start: 0 }])).toBeNull();
    expect(parseTimeline([{ q: "1", start: 0, end: 5 }])).toBeNull();
    expect(parseTimeline([{ q: 1, start: 0, end: Number.NaN }])).toBeNull();
  });

  it("is valid only for exactly one ordered, non-overlapping entry per question", () => {
    expect(isValidTimeline(t, 3)).toBe(true);
    expect(isValidTimeline(t, 4)).toBe(false); // missing question
    expect(isValidTimeline(t.slice(0, 2), 3)).toBe(false);
    expect(isValidTimeline(null, 3)).toBe(false);
    expect(isValidTimeline([{ q: 2, start: 0, end: 5 }], 1)).toBe(false); // wrong order id
    expect(isValidTimeline([t[0]!, { q: 2, start: 10, end: 30 }], 2)).toBe(false); // overlap
    expect(isValidTimeline([{ q: 1, start: 9, end: 9 }], 1)).toBe(false); // empty span
    expect(isValidTimeline([{ q: 1, start: -1, end: 9 }], 1)).toBe(false);
  });

  it("selects the active question from the audio position", () => {
    expect(activePosition(t, 0)).toBe(0); // intro before question 1
    expect(activePosition(t, 5)).toBe(0);
    expect(activePosition(t, 22)).toBe(0); // gap keeps the previous question
    expect(activePosition(t, 25)).toBe(1);
    expect(activePosition(t, 59)).toBe(2);
    expect(activePosition(t, 999)).toBe(2);
  });

  it("only moves forward", () => {
    expect(forwardOnly(3, 1)).toBe(3);
    expect(forwardOnly(1, 3)).toBe(3);
  });

  it("persists the resume position without ever storing a replay", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(readChokaiProgress(storage, "k")).toBeNull();
    writeChokaiProgress(storage, "k", { t: 42.5, finished: false });
    expect(readChokaiProgress(storage, "k")).toEqual({ t: 42.5, finished: false });
    writeChokaiProgress(storage, "k", { t: 100, finished: true });
    expect(readChokaiProgress(storage, "k")?.finished).toBe(true);
    store.set("bad", "{");
    expect(readChokaiProgress(storage, "bad")).toBeNull();
  });
});
