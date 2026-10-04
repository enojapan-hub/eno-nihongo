import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import {
  canNativeInstall,
  isInstalledNow,
  isIosDevice,
  isStandalone,
  promptNativeInstall,
  readDismissed,
  subscribeInstall,
  writeDismissed,
} from "@/lib/pwa-install";

/** Mini-card melayang di tengah viewport. Hanya dipasang di Home (setelah login). */
export function InstallPrompt() {
  const native = useSyncExternalStore(
    subscribeInstall,
    () => canNativeInstall() || isInstalledNow(),
    () => false,
  );
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(true);
  const [iosHelp, setIosHelp] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);
  const ios = typeof window !== "undefined" && isIosDevice();
  const eligible =
    ready &&
    open &&
    !isInstalledNow() &&
    !isStandalone() &&
    !readDismissed(window.localStorage, Date.now()) &&
    (ios || native);
  if (!eligible) return null;
  const dismiss = () => {
    writeDismissed(window.localStorage, Date.now());
    setOpen(false);
  };
  const install = async () => {
    if (ios && !canNativeInstall()) {
      setIosHelp(true);
      return;
    }
    const result = await promptNativeInstall();
    if (result !== "unavailable") dismiss();
  };
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] grid place-items-center px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
      role="presentation"
    >
      <section
        role="dialog"
        aria-label="Pasang ENO NIHONGO"
        className="eno-install-in pointer-events-auto relative w-full max-w-[19rem] rounded-3xl border border-border/70 bg-card p-5 text-center shadow-[0_18px_50px_-18px_rgba(0,0,0,.35)]"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup"
          className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
        <img
          src="/icon-192.png"
          alt=""
          width={56}
          height={56}
          className="mx-auto size-14 rounded-2xl border border-border/60 bg-background object-contain p-1"
        />
        <h2 className="mt-3 text-base font-extrabold tracking-tight">Pasang ENO NIHONGO</h2>
        {iosHelp ? (
          <ol className="mt-2 space-y-1.5 text-left text-xs leading-5 text-muted-foreground">
            <li className="flex items-center gap-2">
              <Share className="size-4 shrink-0 text-primary" /> Tekan <b>Bagikan</b>
            </li>
            <li className="flex items-center gap-2">
              <SquarePlus className="size-4 shrink-0 text-primary" /> Pilih{" "}
              <b>Tambahkan ke Layar Utama</b>
            </li>
            <li className="flex items-center gap-2">
              <Download className="size-4 shrink-0 text-primary" /> Tekan <b>Tambah</b>
            </li>
          </ol>
        ) : (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Akses lebih cepat dari layar utama perangkatmu.
          </p>
        )}
        {!iosHelp && (
          <button
            type="button"
            onClick={() => void install()}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            <Download className="size-4" />
            Instal Aplikasi
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="mt-2 h-9 w-full rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {iosHelp ? "Mengerti" : "Nanti saja"}
        </button>
      </section>
    </div>
  );
}
