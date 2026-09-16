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
    const needsSpace = currentIsWord && previousIsWord && !/\s$/.test(previous) && !/^\s/.test(current);
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
