export function BrandMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className="flex items-center gap-2.5">
      <img
        src="/enonihongo-logo.png"
        alt="ENO NIHONGO"
        className={size === "lg" ? "size-12 object-contain" : "size-9 object-contain"}
      />
      <span className={size === "lg" ? "text-[22px] font-semibold tracking-tight" : "text-[15px] font-semibold tracking-tight"}>
        enonihongo
      </span>
    </span>
  );
}
