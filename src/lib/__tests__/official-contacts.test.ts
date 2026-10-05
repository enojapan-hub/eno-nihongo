import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OFFICIAL_CONTACTS } from "../official-contacts";

const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("official contacts", () => {
  it("points to the official ENO NIHONGO accounts", () => {
    expect(OFFICIAL_CONTACTS.instagram).toEqual({
      handle: "@enonihongo",
      url: "https://www.instagram.com/enonihongo/",
    });
    expect(OFFICIAL_CONTACTS.tiktok).toEqual({
      handle: "@enonihongo.id",
      url: "https://www.tiktok.com/@enonihongo.id",
    });
    expect(OFFICIAL_CONTACTS.email).toEqual({
      address: "enonihongo@gmail.com",
      url: "mailto:enonihongo@gmail.com",
    });
  });
  it("is the single source used by the footer and settings, without stale handles", () => {
    for (const f of ["src/routes/index.tsx", "src/routes/_authenticated/pengaturan.tsx"]) {
      const s = read(f);
      expect(s, f).toMatch(/OFFICIAL_CONTACTS/);
      expect(s, f).not.toMatch(/enottf|enoinjapan/);
    }
  });
  it("opens social links safely in a new tab", () => {
    const s = read("src/routes/index.tsx");
    expect(s).toMatch(/target="_blank"\s+rel="noopener noreferrer"/);
  });
});
