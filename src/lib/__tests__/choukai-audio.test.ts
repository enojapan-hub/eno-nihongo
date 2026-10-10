import { describe, expect, it } from "vitest";
import { hasValidChoukaiAudio } from "@/lib/choukai-audio";

describe("hasValidChoukaiAudio", () => {
  it("accepts http(s) and site-relative audio URLs", () => {
    expect(hasValidChoukaiAudio({ audio_url: "https://cdn.example.com/a.mp3" })).toBe(true);
    expect(hasValidChoukaiAudio({ audio_url: "http://cdn.example.com/a.mp3" })).toBe(true);
    expect(hasValidChoukaiAudio({ audio_url: "/audio/a.mp3" })).toBe(true);
  });

  it("rejects missing, empty, and whitespace-only audio", () => {
    expect(hasValidChoukaiAudio({})).toBe(false);
    expect(hasValidChoukaiAudio({ audio_url: null })).toBe(false);
    expect(hasValidChoukaiAudio({ audio_url: "" })).toBe(false);
    expect(hasValidChoukaiAudio({ audio_url: "   " })).toBe(false);
  });

  it("rejects non-http schemes", () => {
    expect(hasValidChoukaiAudio({ audio_url: "javascript:alert(1)" })).toBe(false);
    expect(hasValidChoukaiAudio({ audio_url: "data:audio/mp3;base64,AAAA" })).toBe(false);
  });
});
