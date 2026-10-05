import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diffRadicals, parseKanjidic2 } from "../../../scripts/kanjidic2-radical-check.mjs";

const XML = `<kanjidic2><header><file_version>4</file_version><database_version>2026-097</database_version><date_of_creation>2026-05-01</date_of_creation></header>
<character><literal>語</literal><radical><rad_value rad_type="classical">149</rad_value><rad_value rad_type="nelson_c">149</rad_value></radical></character>
<character><literal>午</literal><radical><rad_value rad_type="nelson_c">4</rad_value><rad_value rad_type="classical">24</rad_value></radical></character>
<character><literal>X</literal><radical><rad_value rad_type="nelson_c">9</rad_value></radical></character></kanjidic2>`;

describe("KANJIDIC2 check", () => {
  it("reads header and the classical radical only", () => {
    const { header, radicals } = parseKanjidic2(XML);
    expect(header).toEqual({ databaseVersion: "2026-097", dateOfCreation: "2026-05-01" });
    expect([...radicals]).toEqual([
      ["語", 149],
      ["午", 24],
    ]);
  });

  it("reports changed and missing radicals for ENO kanji only", () => {
    const { radicals } = parseKanjidic2(XML);
    expect(diffRadicals({ 語: 149, 午: 24 }, radicals)).toEqual({ changed: [], missing: [] });
    expect(diffRadicals({ 語: 150, 午: 24, 休: 9 }, radicals)).toEqual({
      changed: [{ ch: "語", from: 150, to: 149 }],
      missing: ["休"],
    });
  });

  it("keeps a complete snapshot for every ENO kanji", () => {
    const m = JSON.parse(
      readFileSync(
        new URL("../../../supabase/data/kanjidic2-radicals.json", import.meta.url),
        "utf8",
      ),
    );
    const nums = Object.values(m.radicals) as number[];
    expect(nums).toHaveLength(2220);
    expect(nums.every((n) => Number.isInteger(n) && n >= 1 && n <= 214)).toBe(true);
    expect(m.radicals["語"]).toBe(149);
    expect(m.snapshot.database_version).toBeTruthy();
  });
});
