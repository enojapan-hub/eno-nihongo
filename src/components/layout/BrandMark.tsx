export function BrandMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className="flex items-center gap-3">
      <img
        src="/Logo%20eno%20nihongo%20icon.png"
        alt="ENO NIHONGO"
        className={size === "lg" ? "size-[58px] rounded-2xl object-cover" : "size-[58px] rounded-xl object-cover"}
      />
      <span className="text-[25px] font-semibold tracking-tight">enonihongo</span>
    </span>
  );
}
