import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CROP_MAX_ZOOM,
  clampCrop,
  cropSide,
  cropSourceRect,
  initialCrop,
  panCrop,
  pinchDistance,
  zoomCrop,
} from "../avatar-crop";

describe("crop foto profil 1:1", () => {
  it("awal: persegi terbesar di tengah (landscape dan portrait)", () => {
    expect(cropSourceRect(2000, 1000, initialCrop(2000, 1000))).toEqual({
      sx: 500,
      sy: 0,
      side: 1000,
    });
    expect(cropSourceRect(1000, 2000, initialCrop(1000, 2000))).toEqual({
      sx: 0,
      sy: 500,
      side: 1000,
    });
  });
  it("area crop selalu persegi dan tidak keluar dari gambar", () => {
    for (const zoom of [1, 1.5, 3, 99]) {
      const r = cropSourceRect(1600, 1200, clampCrop(1600, 1200, { zoom, cx: -50, cy: 9999 }));
      expect(r.sx).toBeGreaterThanOrEqual(0);
      expect(r.sy).toBeGreaterThanOrEqual(0);
      expect(r.sx + r.side).toBeLessThanOrEqual(1600 + 1e-9);
      expect(r.sy + r.side).toBeLessThanOrEqual(1200 + 1e-9);
    }
  });
  it("zoom dibatasi dan memperkecil area sumber", () => {
    expect(cropSide(1000, 1000, 2)).toBe(500);
    expect(zoomCrop(1000, 1000, initialCrop(1000, 1000), 99).zoom).toBe(CROP_MAX_ZOOM);
    expect(zoomCrop(1000, 1000, initialCrop(1000, 1000), 0).zoom).toBe(1);
    expect(zoomCrop(1000, 1000, initialCrop(1000, 1000), Number.NaN).zoom).toBe(1);
  });
  it("drag menggeser gambar searah jari dan berhenti di tepi", () => {
    const z2 = zoomCrop(1000, 1000, initialCrop(1000, 1000), 2);
    const moved = panCrop(1000, 1000, z2, 28, 0, 280); // 28px layar = 50 px sumber
    expect(moved.cx).toBe(450);
    expect(panCrop(1000, 1000, z2, 100000, 100000, 280)).toMatchObject({ cx: 250, cy: 250 });
    // zoom 1 pada gambar persegi: tidak ada ruang geser
    expect(panCrop(1000, 1000, initialCrop(1000, 1000), 80, 80, 280)).toMatchObject({
      cx: 500,
      cy: 500,
    });
  });
  it("pinch: jarak dua titik", () => {
    expect(pinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("kontrak editor profil tunggal", () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const edit = read("routes/_authenticated/edit-profil.tsx");
  it("foto dipilih di halaman yang sama: modal crop, bukan navigasi ke halaman foto", () => {
    expect(edit).toContain("<AvatarCropDialog");
    expect(edit).toContain("saveAvatarFile(identity.userId, cropped)");
    expect(edit).not.toContain("profil-foto");
    expect(edit).toContain('accept="image/*,.heic,.heif"');
  });
  it("semua pensil/tombol edit menuju satu rute; rute lama hanya mengalihkan", () => {
    expect(read("routes/_authenticated/dashboard.tsx")).toMatch(
      /to="\/edit-profil"\s+className="grid size-10[^>]*aria-label="Edit profil"/s,
    );
    const profil = read("routes/_authenticated/profil.tsx");
    expect(profil).not.toContain("profil-foto");
    const old = read("routes/_authenticated/profil-foto.tsx");
    expect(old).toContain('redirect({ to: "/edit-profil"');
    for (const f of ["pengaturan", "target"]) {
      expect(read(`routes/_authenticated/${f}.tsx`)).not.toContain("profil-foto");
    }
  });
  it("galat unggah/simpan: pesan Indonesia, tidak ada pesan mentah", () => {
    const save = read("lib/avatar-save.ts");
    expect(save).not.toMatch(/message:\s*(uploadError|profileError)\.message/);
    expect(save).toContain("avatarStorageErrorMessage(uploadError)");
    expect(edit).not.toMatch(/\$\{(daysError|planError|taskError)\.message\}/);
  });
  it("keluaran 512 px JPEG dan HEIC/iPhone memakai reencode yang ada", () => {
    const dialog = read("components/profile/AvatarCropDialog.tsx");
    expect(dialog).toContain("CROP_OUTPUT_SIZE");
    expect(dialog).toContain('"image/jpeg"');
    expect(dialog).toContain("reencodeToJpeg");
    expect(dialog).toContain('imageOrientation: "from-image"');
  });
});
