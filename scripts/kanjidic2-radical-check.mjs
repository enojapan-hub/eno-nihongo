#!/usr/bin/env node
// Prosedur pembaruan berkala data KANJIDIC2 (EDRDG Licence §4: data turunan harus diperbarui rutin dari versi terbaru).
// Hanya membaca berkas resmi dan membandingkannya dengan supabase/data/kanjidic2-radicals.json.
// Tidak menyentuh database, tidak memakai secret. Exit: 0 sama, 1 ada selisih, 2 gagal unduh/parse.
//   node scripts/kanjidic2-radical-check.mjs            # cek saja
//   node scripts/kanjidic2-radical-check.mjs --write    # tulis ulang snapshot (lalu buat migrasi SQL manual & PR)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

export const OFFICIAL_URL = "https://www.edrdg.org/kanjidic/kanjidic2.xml.gz";
const MANIFEST = new URL("../supabase/data/kanjidic2-radicals.json", import.meta.url);

/** Ambil versi header dan bushu klasik per kanji dari XML KANJIDIC2. */
export function parseKanjidic2(xml) {
  const header = {
    databaseVersion: xml.match(/<database_version>([^<]*)<\/database_version>/)?.[1] ?? null,
    dateOfCreation: xml.match(/<date_of_creation>([^<]*)<\/date_of_creation>/)?.[1] ?? null,
  };
  const radicals = new Map();
  for (const m of xml.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
    const literal = m[1].match(/<literal>([^<]+)<\/literal>/)?.[1];
    const classical = m[1].match(/<rad_value rad_type="classical">(\d+)<\/rad_value>/)?.[1];
    if (literal && classical) radicals.set(literal, Number(classical));
  }
  return { header, radicals };
}

/** Bandingkan snapshot ENO dengan versi resmi; hanya kanji ENO yang diperiksa. */
export function diffRadicals(mine, official) {
  const changed = [];
  const missing = [];
  for (const [ch, n] of Object.entries(mine)) {
    if (!official.has(ch)) missing.push(ch);
    else if (official.get(ch) !== n) changed.push({ ch, from: n, to: official.get(ch) });
  }
  return { changed, missing };
}

async function main() {
  const write = process.argv.includes("--write");
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const res = await fetch(OFFICIAL_URL);
  if (!res.ok) throw new Error(`Unduh gagal: HTTP ${res.status}`);
  const gz = Buffer.from(await res.arrayBuffer());
  const sha256 = createHash("sha256").update(gz).digest("hex");
  const { header, radicals } = parseKanjidic2(gunzipSync(gz).toString("utf8"));
  if (radicals.size < 13000 || !header.databaseVersion)
    throw new Error(
      `Berkas tampak tidak lengkap (kanji=${radicals.size}, versi=${header.databaseVersion})`,
    );
  const { changed, missing } = diffRadicals(manifest.radicals, radicals);
  console.log(
    `KANJIDIC2 resmi: versi ${header.databaseVersion} (${header.dateOfCreation}), sha256 ${sha256}\n` +
      `Snapshot ENO : versi ${manifest.snapshot.database_version} (${manifest.snapshot.date_of_creation})\n` +
      `Selisih bushu: ${changed.length}, hilang di sumber: ${missing.length}`,
  );
  console.log(`Hasil: ${changed.length || missing.length ? "DIFFERENT" : "MATCH"}`);
  for (const c of changed) console.log(`  ${c.ch}: ${c.from} -> ${c.to}`);
  for (const ch of missing) console.log(`  ${ch}: tidak ada di KANJIDIC2 resmi`);
  if (write) {
    for (const [ch] of Object.entries(manifest.radicals))
      if (radicals.has(ch)) manifest.radicals[ch] = radicals.get(ch);
    manifest.snapshot = {
      via: "berkas resmi EDRDG",
      database_version: header.databaseVersion,
      date_of_creation: header.dateOfCreation,
      sha256,
      obtained_from_official: true,
    };
    manifest.verification = {
      verified_against_official: true,
      verified_against_version: header.databaseVersion,
      official_date_of_creation: header.dateOfCreation,
      verified_at: new Date().toISOString().slice(0, 10),
      official_sha256: sha256,
      result: changed.length || missing.length ? "DIFFERENT" : "MATCH",
      radical_differences: changed.length,
      missing_in_official: missing.length,
    };
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
    console.log(
      "Snapshot ditulis. Terapkan selisih lewat migrasi SQL manual (lihat docs/kanji-data-sources.md).",
    );
    return 0;
  }
  return changed.length || missing.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(String(err?.message ?? err));
      process.exit(2);
    },
  );
}
