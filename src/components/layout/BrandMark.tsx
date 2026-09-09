export function BrandMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className="flex items-center gap-2.5">
      <img
        src="/Logo%20eno%20nihongo%20icon.png"
        alt="ENO NIHONGO"
        className={size === "lg" ? "size-12 rounded-xl object-cover" : "size-9 rounded-lg object-cover"}
      />
      <span className={size === "lg" ? "text-[22px] font-semibold tracking-tight" : "text-[15px] font-semibold tracking-tight"}>enonihongo</span>
    </span>
  );
}
