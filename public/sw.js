/* ENO NIHONGO service worker: hanya untuk installability. Tidak menyimpan cache apa pun
 * (auth, Supabase, audio, materi, hasil simulasi selalu dari jaringan), jadi deployment baru
 * tidak pernah terjebak aset lama. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
// Handler kosong: semua request tetap diproses browser (network only).
self.addEventListener("fetch", () => {});
