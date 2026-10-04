/**
 * PWA: registrasi service worker minimum (tanpa cache), penangkapan `beforeinstallprompt`,
 * deteksi mode standalone/iOS, dan penyimpanan dismissal ringan di localStorage.
 */
type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

const DISMISS_KEY = "eno-install-dismissed-at";
export const DISMISS_DAYS = 14;

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let started = false;
let consumed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || iPadOs;
}

export function readDismissed(storage: Pick<Storage, "getItem"> | undefined, now: number): boolean {
  try {
    const raw = storage?.getItem(DISMISS_KEY);
    const at = raw ? Number(raw) : NaN;
    return Number.isFinite(at) && now - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function writeDismissed(storage: Pick<Storage, "setItem"> | undefined, now: number) {
  try {
    storage?.setItem(DISMISS_KEY, String(now));
  } catch {
    /* penyimpanan tidak tersedia: prompt hanya tampil lagi pada sesi berikutnya */
  }
}

/** Dipanggil sekali dari root: pendaftaran SW + listener install. */
export function initPwa() {
  if (typeof window === "undefined" || started) return;
  started = true;
  // Skrip kecil di <head> (lihat __root.tsx) menangkap event sebelum hydration; baca hasilnya di sini.
  const w = window as Window & { __enoInstallEvent?: Event; __enoInstalled?: boolean };
  const sync = () => {
    if (w.__enoInstalled) {
      installed = true;
      deferred = null;
    } else if (w.__enoInstallEvent && !consumed) {
      deferred = w.__enoInstallEvent as BeforeInstallPromptEvent;
    }
    emit();
  };
  sync();
  window.addEventListener("eno:install-available", sync);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    w.__enoInstallEvent = event;
    sync();
  });
  window.addEventListener("appinstalled", () => {
    w.__enoInstalled = true;
    sync();
  });
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    });
  }
}

export function subscribeInstall(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const canNativeInstall = () => deferred !== null && !installed;
export const isInstalledNow = () => installed;

/** Membuka prompt instal bawaan browser; false bila tidak tersedia. */
export async function promptNativeInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const event = deferred;
  deferred = null;
  consumed = true;
  emit();
  await event.prompt();
  const choice = await event.userChoice.catch(() => ({ outcome: "dismissed" as const }));
  return choice.outcome;
}
