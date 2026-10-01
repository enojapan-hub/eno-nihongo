const LOGO_VERSION = "20260909-new";

export function BrandLogo({ className = "size-[58px]" }: { className?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl">
      <img src={`/enonihongo-logo-dark.png?v=${LOGO_VERSION}`} alt="ENO NIHONGO" className={`${className} object-cover dark:hidden`} />
      <img src={`/enonihongo-logo-light.png?v=${LOGO_VERSION}`} alt="ENO NIHONGO" className={`hidden ${className} object-cover dark:block`} />
    </span>
  );
}

export function BrandMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className="flex items-center gap-3">
      <BrandLogo />
      <span className="text-[25px] font-semibold tracking-tight">enonihongo</span>
    </span>
  );
}
