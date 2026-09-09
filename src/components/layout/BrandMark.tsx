export function BrandMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className="flex items-center gap-3">
      <span className="inline-flex size-[58px] shrink-0 items-center justify-center overflow-hidden rounded-xl dark:bg-white dark:ring-1 dark:ring-white/20">
        <img
          src="/Logo%20eno%20nihongo%20icon.png"
          alt="ENO NIHONGO"
          className="size-[58px] object-cover"
        />
      </span>
      <span className="text-[25px] font-semibold tracking-tight">enonihongo</span>
    </span>
  );
}
