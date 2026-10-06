/**
 * Matematika crop foto profil (murni, tanpa DOM). Pusat crop dinyatakan dalam koordinat gambar sumber;
 * area crop selalu persegi (1:1) dan tidak pernah keluar dari gambar.
 */
export const CROP_MIN_ZOOM = 1;
export const CROP_MAX_ZOOM = 4;
export const CROP_OUTPUT_SIZE = 512;

export interface CropState {
  zoom: number;
  /** Pusat area crop di koordinat gambar sumber (piksel). */
  cx: number;
  cy: number;
}

export const clampZoom = (zoom: number): number =>
  Math.min(CROP_MAX_ZOOM, Math.max(CROP_MIN_ZOOM, Number.isFinite(zoom) ? zoom : CROP_MIN_ZOOM));

/** Sisi persegi crop di gambar sumber pada zoom tertentu (zoom 1 = sisi terpendek gambar). */
export const cropSide = (imgW: number, imgH: number, zoom: number): number =>
  Math.min(imgW, imgH) / clampZoom(zoom);

/** Jaga area crop tetap di dalam gambar. */
export function clampCrop(imgW: number, imgH: number, state: CropState): CropState {
  const zoom = clampZoom(state.zoom);
  const half = cropSide(imgW, imgH, zoom) / 2;
  return {
    zoom,
    cx: Math.min(imgW - half, Math.max(half, state.cx)),
    cy: Math.min(imgH - half, Math.max(half, state.cy)),
  };
}

export const initialCrop = (imgW: number, imgH: number): CropState => ({
  zoom: CROP_MIN_ZOOM,
  cx: imgW / 2,
  cy: imgH / 2,
});

/** Geser (drag) dalam piksel layar → pusat baru. Menggeser jari ke kanan memajukan gambar ke kanan. */
export function panCrop(
  imgW: number,
  imgH: number,
  state: CropState,
  dxScreen: number,
  dyScreen: number,
  boxSize: number,
): CropState {
  const sourcePerScreen = cropSide(imgW, imgH, state.zoom) / boxSize;
  return clampCrop(imgW, imgH, {
    zoom: state.zoom,
    cx: state.cx - dxScreen * sourcePerScreen,
    cy: state.cy - dyScreen * sourcePerScreen,
  });
}

/** Ganti zoom sambil menjaga pusat; hasil selalu valid. */
export const zoomCrop = (imgW: number, imgH: number, state: CropState, zoom: number): CropState =>
  clampCrop(imgW, imgH, { ...state, zoom });

/** Persegi sumber yang akan digambar ke kanvas keluaran. */
export function cropSourceRect(imgW: number, imgH: number, state: CropState) {
  const clamped = clampCrop(imgW, imgH, state);
  const side = cropSide(imgW, imgH, clamped.zoom);
  return { sx: clamped.cx - side / 2, sy: clamped.cy - side / 2, side };
}

/** Jarak dua titik sentuh (untuk pinch-zoom). */
export const pinchDistance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);
