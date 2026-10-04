import { useLayoutEffect, useRef, type ReactNode } from "react";
import { fitScale } from "@/lib/fit-scale";

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
      innerEl.style.transform = "none";
      const heightAt = (scale: number) => {
        innerEl.style.width = `${100 / scale}%`;
        return innerEl.offsetHeight;
      };
      const scale = fitScale(height, heightAt);
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
