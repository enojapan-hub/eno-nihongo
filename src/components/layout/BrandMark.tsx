export function BrandMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className="flex items-center gap-3">
      <img
        src="/Logo%20eno%20nihongo%20icon.png"
        alt="ENO NIHONGO"
        className={size === "lg" ? "size-16 rounded-2xl object-cover" : "size-12 rounded-xl object-cover"}
      />
      <span className={size === "lg" ? "text-[26px] font-semibold tracking-tight" : "text-[19px] font-semibold tracking-tight"}>enonihongo</span>
    </span>
  );
}
