import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DISMISS_DAYS, readDismissed, writeDismissed } from "../pwa-install";
import { fitScale } from "../fit-scale";

const pub = (file: string) => resolve(__dirname, "../../../public", file);
const pngSize = (file: string) => {
  const buf = readFileSync(pub(file));
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
};

describe("PWA manifest + branding assets", () => {
  const manifest = JSON.parse(readFileSync(pub("manifest.webmanifest"), "utf8"));
  it("manifest is installable and branded", () => {
    expect(manifest.name).toBe("ENO NIHONGO");
    expect(manifest.short_name).toBe("ENO NIHONGO");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBeUndefined();
  });
  it("every manifest icon exists with the declared square size", () => {
    for (const icon of manifest.icons as { src: string; sizes: string }[]) {
      const file = icon.src.replace(/^\//, "");
      expect(existsSync(pub(file))).toBe(true);
      const [w, h] = pngSize(file);
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  });
  it("favicon set is square and favicon.ico is multi-size (16/32/48)", () => {
    expect(pngSize("favicon-16x16.png")).toEqual([16, 16]);
    expect(pngSize("favicon-32x32.png")).toEqual([32, 32]);
    expect(pngSize("apple-touch-icon.png")).toEqual([180, 180]);
    const ico = readFileSync(pub("favicon.ico"));
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
  });
  it("service worker never caches or intercepts requests", () => {
    const sw = readFileSync(pub("sw.js"), "utf8");
    expect(sw).not.toMatch(/caches\.(open|match|add)/);
    expect(sw).not.toMatch(/respondWith/);
  });
});

describe("install prompt dismissal", () => {
  const store = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
  };
  it("hides for DISMISS_DAYS then shows again", () => {
    const s = store();
    const now = 1_000_000_000_000;
    expect(readDismissed(s, now)).toBe(false);
    writeDismissed(s, now);
    expect(readDismissed(s, now + 86_400_000)).toBe(true);
    expect(readDismissed(s, now + (DISMISS_DAYS + 1) * 86_400_000)).toBe(false);
  });
  it("tolerates missing/broken storage", () => {
    expect(readDismissed(undefined, 1)).toBe(false);
    expect(readDismissed({ getItem: () => "abc" }, 1)).toBe(false);
  });
});

describe("fitScale upscale limit", () => {
  it("can start above 1 only when max allows, and still shrinks to fit", () => {
    expect(fitScale(300, () => 100, 0.6, 0.04, 1.35)).toBe(1.35);
    expect(fitScale(300, () => 100)).toBe(1);
    const s = fitScale(300, (scale) => 400 / scale, 0.6, 0.04, 1.35);
    expect(s).toBeLessThan(1);
  });
});
