import { useLayoutEffect, useRef, type ReactNode } from "react";
import { fitScale } from "@/lib/fit-scale";

const BASE_WIDTH = 440;
const MAX_UPSCALE = 1.35;

/** Menskalakan konten ke dalam kotak berukuran tetap tanpa scroll, clipping, atau perubahan ukuran kartu. */
export function FitContent({ children, watch }: { children: ReactNode; watch: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const boxEl = box.current;
    const innerEl = inner.current;
    if (!boxEl || !innerEl) return;
    const measure = () => {
      const height = boxEl.clientHeight;
      // Kartu lebar (tablet/desktop) boleh menampilkan konten lebih besar; di ponsel (< 440px) tetap 1.
      const maxScale = Math.min(MAX_UPSCALE, Math.max(1, boxEl.clientWidth / BASE_WIDTH));
      innerEl.style.transform = "none";
      const heightAt = (scale: number) => {
        innerEl.style.width = `${100 / scale}%`;
        return innerEl.offsetHeight;
      };
      const scale = fitScale(height, heightAt, 0.6, 0.04, maxScale);
      const contentHeight = heightAt(scale) * scale;
      const offset = Math.max(0, Math.floor((height - contentHeight) / 2));
      innerEl.style.transform = `translateY(${offset}px) scale(${scale})`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(boxEl);
    return () => observer.disconnect();
  }, [watch]);

  return (
    <div ref={box} className="relative h-full w-full">
      <div
        ref={inner}
        className="absolute left-0 top-0 text-center"
        style={{ transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}
