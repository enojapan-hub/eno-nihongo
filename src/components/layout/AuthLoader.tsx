import { BrandLogo } from "@/components/layout/BrandMark";

/** Layar tunggu saat sesi sedang diselesaikan (callback OAuth/verifikasi, sesi tersimpan). */
export function AuthLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f7f4] dark:bg-background">
      <div role="status" aria-label="Memuat" className="animate-[pulse_1.25s_ease-in-out_infinite]">
        <BrandLogo className="size-[84px]" />
      </div>
    </div>
  );
}
