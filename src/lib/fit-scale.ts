/**
 * Skala terbesar (≤ max, ≥ min; max default 1) agar konten setinggi `heightAt(scale)` muat di kotak setinggi `box`.
 * Saat skala turun, lebar logis konten naik (100/scale) sehingga teks wrap lebih longgar.
 */
export function fitScale(
  box: number,
  heightAt: (scale: number) => number,
  min = 0.6,
  step = 0.04,
  max = 1,
): number {
  let scale = max;
  while (scale > min && heightAt(scale) * scale > box)
    scale = Math.round((scale - step) * 100) / 100;
  return Math.max(scale, min);
}
