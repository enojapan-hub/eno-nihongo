import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHAT_SOUND_COOLDOWN_MS, createSoundGate } from "../social/chat-sound";
import {
  googlePhotoFromMetadata,
  googlePhotoToSync,
  isGooglePhotoUrl,
  sizedPhoto,
} from "../social/profile-photo";
import { onlineFromState } from "../social/social-presence";

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), "utf8");
const G = "https://lh3.googleusercontent.com/a/ACg8ocKxyz=s96-c";
const G2 = "https://lh3.googleusercontent.com/a/ACg8ocNEW=s96-c";
const UPLOAD = "https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/u/p.png";

describe("profile photo (single source: profiles.avatar_url)", () => {
  it("recognises Google photo URLs only", () => {
    expect(isGooglePhotoUrl(G)).toBe(true);
    for (const bad of [
      UPLOAD,
      "http://lh3.googleusercontent.com/x",
      "https://evil.example/lh3.googleusercontent.com/",
      "",
      null,
      undefined,
    ])
      expect(isGooglePhotoUrl(bad)).toBe(false);
  });
  it("asks Google for a sharp size instead of enlarging 96px", () => {
    expect(sizedPhoto(G, 640)).toBe("https://lh3.googleusercontent.com/a/ACg8ocKxyz=s640-c");
    expect(sizedPhoto(UPLOAD, 640)).toBe(UPLOAD);
    expect(sizedPhoto(G, 5000)).toMatch(/=s1024-c$/);
  });
  it("reads the Google picture from Auth metadata (avatar_url or picture), nothing else", () => {
    expect(googlePhotoFromMetadata({ picture: G })).toBe(G);
    expect(googlePhotoFromMetadata({ avatar_url: G, picture: G2 })).toBe(G);
    expect(googlePhotoFromMetadata({ picture: "https://evil.example/x.png" })).toBeNull();
    expect(googlePhotoFromMetadata({ email: "a@b.c" })).toBeNull();
    expect(googlePhotoFromMetadata(null)).toBeNull();
  });
  it("syncs only when changed, and never overwrites an uploaded photo", () => {
    expect(googlePhotoToSync(null, G)).toBe(G); // kosong → isi
    expect(googlePhotoToSync("", G)).toBe(G);
    expect(googlePhotoToSync(G, G2)).toBe(G2); // Google berubah
    expect(googlePhotoToSync(G, G)).toBeNull(); // sama → tanpa tulis (tanpa loop)
    expect(googlePhotoToSync(UPLOAD, G2)).toBeNull(); // unggahan dilindungi
    expect(googlePhotoToSync(G, null)).toBeNull();
    expect(googlePhotoToSync(G, "https://evil.example/x.png")).toBeNull();
  });
  it("sync hook writes only the avatar_url of the signed-in user and never touches email/tokens", () => {
    const src = read("src/hooks/useGooglePhotoSync.ts");
    expect(src).toMatch(/\.update\(\{ avatar_url: next \}\)\s*\.eq\("id", userId\)/);
    expect(src).not.toMatch(/email|access_token|refresh_token|provider_token/);
    expect(read("src/components/social/ChatDock.tsx")).toMatch(/useGooglePhotoSync\(user\)/);
  });
});

describe("avatar root cause is fixed at the source", () => {
  it("no surface renders the generic User icon any more; they use photo → ENO mascot", () => {
    const a = read("src/components/social/SocialAvatar.tsx");
    expect(a).not.toMatch(/UserRound/);
    expect(a).toMatch(/DEFAULT_PHOTO_SMALL/);
    expect(a).toMatch(/onError/);
    for (const f of ["MessageList", "FriendsPanel", "DmPanel"])
      expect(read(`src/components/social/${f}.tsx`), f).toMatch(/<SocialAvatar[^>]*userId=/);
  });
  it("server only forwards vetted photo URLs and the card RPC returns bio/country/xp", () => {
    const sql = read("supabase/migrations/20261012000000_social_profile_v3.sql");
    expect(sql).toMatch(/social_safe_photo\(avatar_url\), bio, country/);
    expect(sql).toMatch(/'photo', v_photo/);
    expect(sql).toMatch(/'xp', coalesce\(v_xp, 0\)/);
    expect(sql.replace(/--.*$/gm, "")).not.toMatch(/email|raw_user_meta_data|provider_token/i);
  });
});

describe("chat sound gate", () => {
  const msg = (
    o: Partial<Parameters<ReturnType<typeof createSoundGate>["shouldPlay"]>[0]> = {},
  ) => ({
    id: "m1",
    senderId: "other",
    meId: "me",
    enabled: true,
    ...o,
  });
  it("plays once for a new incoming message", () => {
    const g = createSoundGate({ now: () => 0 });
    expect(g.shouldPlay(msg())).toBe(true);
  });
  it("never plays for my own message", () => {
    expect(createSoundGate().shouldPlay(msg({ senderId: "me" }))).toBe(false);
  });
  it("a duplicate event for the same id never plays twice", () => {
    let t = 0;
    const g = createSoundGate({ now: () => t });
    expect(g.shouldPlay(msg())).toBe(true);
    t += 10_000;
    expect(g.shouldPlay(msg())).toBe(false);
  });
  it("a burst produces a single sound; later messages play again after the cooldown", () => {
    let t = 0;
    const g = createSoundGate({ now: () => t });
    expect(g.shouldPlay(msg({ id: "a" }))).toBe(true);
    t += 200;
    expect(g.shouldPlay(msg({ id: "b" }))).toBe(false);
    t += 200;
    expect(g.shouldPlay(msg({ id: "c" }))).toBe(false);
    t += CHAT_SOUND_COOLDOWN_MS;
    expect(g.shouldPlay(msg({ id: "d" }))).toBe(true);
  });
  it("is silent when the setting is off, and an id seen while off does not replay when turned on", () => {
    const g = createSoundGate({ now: () => 0 });
    expect(g.shouldPlay(msg({ enabled: false }))).toBe(false);
    expect(g.shouldPlay(msg({ enabled: true }))).toBe(false);
    expect(g.shouldPlay(msg({ id: "m2", enabled: true }))).toBe(true);
  });
  it("ignores events without id/sender/me", () => {
    const g = createSoundGate();
    expect(g.shouldPlay(msg({ id: undefined }))).toBe(false);
    expect(g.shouldPlay(msg({ id: "x", senderId: undefined }))).toBe(false);
    expect(g.shouldPlay(msg({ id: "y", meId: null }))).toBe(false);
  });
  it("is wired only to the existing Realtime DM insert event (no extra channel, global chat silent)", () => {
    const dock = read("src/components/social/ChatDock.tsx");
    expect(dock.match(/handleIncomingMessage\(/g)).toHaveLength(1);
    expect(dock.match(/supabase\s*\.channel\(/g)).toHaveLength(1); // channel postgres_changes tunggal
    const dmInsert = dock.slice(dock.indexOf('table: "dm_messages" }, (p) => {'));
    expect(dmInsert.indexOf("handleIncomingMessage")).toBeGreaterThan(-1);
    const globalInsert = dock.slice(
      dock.indexOf('event: "INSERT", schema: "public", table: "global_messages"'),
      dock.indexOf('event: "UPDATE", schema: "public", table: "global_messages"'),
    );
    expect(globalInsert).not.toMatch(/handleIncomingMessage/);
    expect(dock).toMatch(/me\?\.sound_enabled !== false/);
  });
  it("playback never throws and unlock is gesture-based", () => {
    const src = read("src/lib/social/chat-sound.ts");
    expect(src).toMatch(/\.catch\(\(\) => undefined\)/);
    expect(src).toMatch(/pointerdown/);
    expect(src).not.toMatch(/console\./);
  });
  it("ships a small original WAV asset", () => {
    const wav = readFileSync(join(root, "public/sounds/chat-notify.wav"));
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.subarray(8, 12).toString()).toBe("WAVE");
    expect(wav.length).toBeLessThan(60_000);
  });
  it("persists the toggle (default on) in social_settings and exposes it in social_me", () => {
    const sql = read("supabase/migrations/20261012000000_social_profile_v3.sql");
    expect(sql).toMatch(/sound_enabled boolean not null default true/);
    expect(sql).toMatch(/'sound_enabled', coalesce\(ss\.sound_enabled, true\)/);
    expect(sql).toMatch(
      /grant execute on function public\.social_set_sound\(boolean\) to authenticated/,
    );
    expect(read("src/components/social/SocialAccountCard.tsx")).toMatch(/aria-label="Suara pesan"/);
  });
});

describe("presence", () => {
  it("online iff at least one live session exists for the key", () => {
    const s = onlineFromState({ a: [{}], b: [{}, {}], c: [], d: undefined });
    expect([...s].sort()).toEqual(["a", "b"]);
    expect(onlineFromState(null).size).toBe(0);
  });
  it("uses one Presence channel keyed by account id and cleans it up; no database flag, no last seen", () => {
    const src = read("src/lib/social/social-presence.ts");
    expect(src.match(/supabase\.channel\(/g)).toHaveLength(1);
    expect(src).toMatch(/presence: \{ key: userId \}/);
    expect(src).toMatch(/untrack\(\)/);
    expect(src).toMatch(/removeChannel\(channel\)/);
    expect(src).not.toMatch(/last_seen|lastSeen|\.from\(/);
    expect(read("src/components/social/ChatDock.tsx")).toMatch(
      /usePresenceTracking\(userId, me\?\.show_online !== false\)/,
    );
  });
});

describe("profile card content + Edit Profil bio", () => {
  const card = read("src/components/social/SocialProfileCard.tsx");
  it("is a portrait card with a large photo on top, not a small circle", () => {
    expect(card).toMatch(/aspect-\[4\/3\]/);
    expect(card).toMatch(/<ProfilePhoto/);
    expect(card).not.toMatch(/<SocialAvatar|aspect-square/);
  });
  it("shows bio only when present and uses real data for country/levels/xp/online", () => {
    expect(card).toMatch(/\{c\.bio && \(/);
    expect(card).toMatch(/\{c\.country && \(/);
    expect(card).toMatch(/c\.xp !== null \? getAccountLevel\(c\.xp\)\.level : null/);
    expect(card).toMatch(/JLPT \{jlpt\}/);
    expect(card).toMatch(/useIsOnline\(userId\)/);
    expect(card).toMatch(/\{online && c\.show_online && \(/);
    expect(card).not.toMatch(/dangerouslySetInnerHTML/);
  });
  it("Edit Profil has a 160-char bio, trimmed on save, stored via the existing profile save", () => {
    const edit = read("src/routes/_authenticated/edit-profil.tsx");
    expect(edit).toMatch(/Ceritakan sedikit tentang dirimu\.\.\./);
    expect(edit).toMatch(/maxLength=\{160\}/);
    expect(edit).toMatch(/bio: data\.bio\.trim\(\)/);
    expect(edit).toMatch(/\{data\.bio\.length\}\/160/);
    const fn = read("src/lib/profile.functions.ts");
    expect(fn).toMatch(/bio: z\.string\(\)\.trim\(\)\.max\(160\)\.optional\(\)/);
    expect(fn).toMatch(/update\.bio = data\.bio === "" \? null : data\.bio/);
  });
});
