import { useEffect, useRef, type ReactNode } from "react";

const TARGET_ROUTES = [
  "/kanji",
  "/bunpo",
  "/dokkai",
  "/hafalan",
  "/simulasi",
  "/simulasi-bagian",
  "/simulasi-penuh",
  "/kosakata",
  "/kotoba",
];

const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9fff々〆ヵヶ]/;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION", "RT", "RP"]);

function isTargetRoute(pathname: string) {
  return TARGET_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

type CharClass = "kanji" | "kana" | "katakana" | "alnum" | "other";

function charClass(ch: string): CharClass {
  if (/[㐀-鿿々〆]/.test(ch)) return "kanji";
  if (/[゠-ヿヵヶー]/.test(ch)) return "katakana";
  if (/[぀-ゟ]/.test(ch)) return "kana";
  if (/[0-9０-９a-zA-Zａ-ｚＡ-Ｚ]/.test(ch)) return "alnum";
  return "other";
}

// The ICU word segmenter splits inside one word (閉|ま|って, 日本|語). A space is only added where a new
// bunsetsu starts: a kanji/katakana/latin segment that follows a different script. Hiragana segments
// (okurigana, inflection, particles) always stay attached to the word before them.
function startsNewBunsetsu(previous: string, current: string) {
  const first = charClass(current.charAt(0));
  const last = charClass(previous.charAt(previous.length - 1));
  if (first === "kana" || first === "other") return false;
  if (first === last) return false;
  if ((first === "kanji" && last === "alnum") || (first === "alnum" && last === "kanji")) return false;
  if (first === "kanji" && /^[おご御]$/.test(previous)) return false;
  return true;
}

function normalizeJapaneseSpacing(text: string) {
  if (!JAPANESE_RE.test(text) || typeof Intl === "undefined" || !("Segmenter" in Intl)) return text;
  const Segmenter = Intl.Segmenter as typeof Intl.Segmenter;
  const segmenter = new Segmenter("ja", { granularity: "word" });
  const segments = Array.from(segmenter.segment(text));
  if (segments.length < 2) return text;

  let output = "";
  for (let i = 0; i < segments.length; i += 1) {
    const current = segments[i].segment;
    const previous = i > 0 ? segments[i - 1].segment : "";
    const currentIsWord = Boolean(segments[i].isWordLike);
    const previousIsWord = i > 0 && Boolean(segments[i - 1].isWordLike);
    const needsSpace = currentIsWord && previousIsWord && !/\s$/.test(previous) && !/^\s/.test(current) && startsNewBunsetsu(previous, current);
    if (needsSpace && output && !output.endsWith(" ")) output += " ";
    output += current;
  }
  return output.replace(/[ \t]+([、。！？!?）」』】〕〉》])/g, "$1").replace(/([（「『【〔〈《])[ \t]+/g, "$1");
}

function formatTextNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (parent && !SKIP_TAGS.has(parent.tagName) && !parent.closest("[data-no-japanese-spacing], ruby, [contenteditable='true']") && JAPANESE_RE.test(textNode.data)) nodes.push(textNode);
    node = walker.nextNode();
  }
  for (const textNode of nodes) {
    const next = normalizeJapaneseSpacing(textNode.data);
    if (next !== textNode.data) textNode.data = next;
  }
}

export function JapaneseSpacing({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !isTargetRoute(window.location.pathname) || window.location.pathname.startsWith("/choukai")) return;
    let queued = false;
    const run = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        if (ref.current) formatTextNodes(ref.current);
      });
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
