/**
 * Suara pesan masuk. Logika "boleh bunyi atau tidak" murni (mudah diuji); pemutaran memakai satu
 * elemen Audio dan tidak pernah melempar galat (autoplay ditolak browser = diam, tampilan tetap jalan).
 */
export const CHAT_SOUND_URL = "/sounds/chat-notify.wav";
export const CHAT_SOUND_COOLDOWN_MS = 1500;
const SEEN_MAX = 300;

export type IncomingMessage = {
  id: string | null | undefined;
  senderId: string | null | undefined;
  meId: string | null | undefined;
  enabled: boolean;
  /** Percakapan ini di-mute: pesan tetap masuk, hanya bunyi yang ditahan. */
  muted?: boolean;
};

export function createSoundGate(opts: { cooldownMs?: number; now?: () => number } = {}) {
  const cooldown = opts.cooldownMs ?? CHAT_SOUND_COOLDOWN_MS;
  const now = opts.now ?? (() => Date.now());
  const seen = new Set<string>();
  let lastAt = Number.NEGATIVE_INFINITY;
  return {
    /** true = bunyi sekarang. Setiap id hanya diproses sekali, termasuk saat suara dimatikan. */
    shouldPlay(m: IncomingMessage): boolean {
      if (!m.id) return false;
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      if (seen.size > SEEN_MAX) {
        const first = seen.values().next().value;
        if (first !== undefined) seen.delete(first);
      }
      if (!m.enabled || m.muted || !m.meId || !m.senderId || m.senderId === m.meId) return false;
      const t = now();
      if (t - lastAt < cooldown) return false;
      lastAt = t;
      return true;
    },
    reset() {
      seen.clear();
      lastAt = Number.NEGATIVE_INFINITY;
    },
  };
}

let audio: HTMLAudioElement | null = null;
function element(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!audio) {
    audio = new Audio(CHAT_SOUND_URL);
    audio.preload = "auto";
    audio.volume = 0.6;
  }
  return audio;
}

export function playChatSound(): void {
  try {
    const a = element();
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => undefined);
  } catch {
    /* diam: pemutaran tidak boleh mengganggu aplikasi */
  }
}

let armed = false;
/** Safari/iOS: audio baru boleh diputar setelah gestur pengguna. Dipanggil sekali; mengembalikan cleanup. */
export function armChatSound(): () => void {
  if (armed || typeof window === "undefined") return () => undefined;
  armed = true;
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const unlock = () => {
    cleanup();
    try {
      const a = element();
      if (!a) return;
      a.muted = true;
      void a
        .play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        })
        .catch(() => {
          a.muted = false;
        });
    } catch {
      /* abaikan */
    }
  };
  const cleanup = () => {
    for (const e of events) window.removeEventListener(e, unlock);
    armed = false;
  };
  for (const e of events) window.addEventListener(e, unlock, { passive: true });
  return cleanup;
}

/** Gate tunggal aplikasi + pemutaran. Dipanggil dari event Realtime DM yang sudah ada. */
const gate = createSoundGate();
export function handleIncomingMessage(m: IncomingMessage): boolean {
  const play = gate.shouldPlay(m);
  if (play) playChatSound();
  return play;
}
export function resetChatSound(): void {
  gate.reset();
}
