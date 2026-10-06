import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CROP_MAX_ZOOM,
  CROP_MIN_ZOOM,
  CROP_OUTPUT_SIZE,
  cropSourceRect,
  initialCrop,
  panCrop,
  pinchDistance,
  zoomCrop,
  type CropState,
} from "@/lib/avatar-crop";
import { AVATAR_PROCESS_FAILED, needsReencode, reencodeToJpeg } from "@/lib/avatar-upload";

const MAX_SOURCE_SIDE = 2048;
const BOX = 280;

/** Decode (orientasi EXIF dihormati) lalu kecilkan ke kanvas sumber ≤ 2048 px. HEIC hanya bila browser mampu. */
async function loadSource(original: File): Promise<HTMLCanvasElement> {
  const file = needsReencode(original) ? await reencodeToJpeg(original) : original;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
}

function render(
  target: HTMLCanvasElement,
  source: HTMLCanvasElement,
  state: CropState,
  px: number,
) {
  const { sx, sy, side } = cropSourceRect(source.width, source.height, state);
  target.width = px;
  target.height = px;
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, px, px);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, side, side, 0, 0, px, px);
}

export function AvatarCropDialog({
  file,
  busy,
  onCancel,
  onConfirm,
}: {
  file: File;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<CropState | null>(null);
  const [failed, setFailed] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    let active = true;
    loadSource(file)
      .then((canvas) => {
        if (!active) return;
        setSource(canvas);
        setState(initialCrop(canvas.width, canvas.height));
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [file]);

  useEffect(() => {
    if (source && state && previewRef.current) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      render(previewRef.current, source, state, Math.round(BOX * dpr));
    }
  }, [source, state]);

  const update = useCallback(
    (fn: (current: CropState, src: HTMLCanvasElement) => CropState) =>
      setState((current) => (current && source ? fn(current, source) : current)),
    [source],
  );

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && state) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      pinch.current = { distance: pinchDistance(a, b), zoom: state.zoom };
    }
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, next);
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const ratio = pinchDistance(a, b) / pinch.current.distance;
      const base = pinch.current.zoom;
      update((c, s) => zoomCrop(s.width, s.height, c, base * ratio));
      return;
    }
    update((c, s) => panCrop(s.width, s.height, c, next.x - previous.x, next.y - previous.y, BOX));
  }
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }
  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    update((c, s) => zoomCrop(s.width, s.height, c, c.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08)));
  }

  async function confirm() {
    if (!source || !state) return;
    const out = document.createElement("canvas");
    render(out, source, state, CROP_OUTPUT_SIZE);
    const blob = await new Promise<Blob | null>((resolve) =>
      out.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob) {
      setFailed(true);
      return;
    }
    onConfirm(new File([blob], "foto-profil.jpg", { type: "image/jpeg" }));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atur foto profil"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
    >
      <div className="w-full max-w-[340px] rounded-3xl bg-background p-5 shadow-2xl">
        <h2 className="text-center text-[16px] font-bold">Atur Foto Profil</h2>
        {failed ? (
          <div className="py-8 text-center">
            <p role="alert" className="text-xs text-destructive">
              {AVATAR_PROCESS_FAILED}
            </p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={onCancel}>
              Tutup
            </Button>
          </div>
        ) : !source || !state ? (
          <div className="grid h-[280px] place-items-center text-xs text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            <p className="mt-1 text-center text-[10px] text-muted-foreground">
              Geser untuk memosisikan, cubit atau gunakan penggeser untuk zoom.
            </p>
            <div
              data-testid="crop-area"
              className="relative mx-auto mt-3 touch-none select-none overflow-hidden rounded-full border-4 border-background shadow-lg"
              style={{ width: BOX, height: BOX, maxWidth: "100%" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
            >
              <canvas
                ref={previewRef}
                data-testid="crop-preview"
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
            <label className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
              <ZoomIn className="size-4" />
              <span className="sr-only">Zoom</span>
              <input
                type="range"
                aria-label="Zoom"
                min={CROP_MIN_ZOOM}
                max={CROP_MAX_ZOOM}
                step={0.01}
                value={state.zoom}
                onChange={(e) => {
                  const zoom = Number(e.target.value);
                  update((c, s) => zoomCrop(s.width, s.height, c, zoom));
                }}
                className="min-w-0 flex-1 accent-[#1f6f4a]"
                disabled={busy}
              />
            </label>
            <div className="mt-5 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={onCancel}
                disabled={busy}
              >
                Batal
              </Button>
              <Button className="flex-1 rounded-xl" onClick={() => void confirm()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {busy ? "Menyimpan…" : "Gunakan Foto"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
