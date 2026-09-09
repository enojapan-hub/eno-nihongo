export function BrandMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className="flex items-center gap-3">
      <span className="inline-flex size-[58px] shrink-0 items-center justify-center overflow-hidden rounded-xl">
        <img
          src="/enonihongo-logo-light.png"
          alt="ENO NIHONGO"
          className="size-[58px] object-cover dark:hidden"
        />
        <img
          src="/enonihongo-logo-dark.png"
          alt="ENO NIHONGO"
          className="hidden size-[58px] object-cover dark:block"
        />
      </span>
      <span className="text-[25px] font-semibold tracking-tight">enonihongo</span>
    </span>
  );
}
