/**
 * Kaba saat — dakikalık geri sayımlar için (PROJECT.md §12).
 *
 * NEDEN BİR DIŞ SİSTEM. Zaman, React'in bilmediği bir yerde akıyor; `Date.now`
 * render sırasında okunursa sunucu ve istemci farklı değer üretir, efekt içinde
 * okunup `setState` çağrılırsa basamaklı render doğar. `daily-storage.ts`
 * aynı gerekçeyle aynı arayüzü kullanıyor: `useSyncExternalStore`.
 *
 * SUNUCU GÖRÜNTÜSÜ `null` ve bu hidrasyonun tek doğru cevabı: sunucunun saati
 * ile kullanıcının saati aynı değil. İlk çizimde geri sayım yerine bir tire
 * duruyor, hidrasyondan sonra gerçek değer geliyor — React bu geçişi kendisi
 * yönetiyor.
 *
 * YİRMİ SANİYEDE BİR, saniyede bir değil. Gösterilen birim dakika ve eşikler
 * otuz ile altmış dakika (BR-60); saniyelik bir sayaç hiçbir karara yaramadan
 * her saniye yeniden çizerdi.
 *
 * ZAMANLAYICI DİNLEYİCİ YOKKEN ÇALIŞMAZ. Oda bittiğinde geri sayım ekrandan
 * kalkıyor ve son dinleyici ayrılınca `setInterval` durduruluyor; aksi hâlde
 * arka planda ölmüş bir sayaç sayfanın ömrü boyunca tıklardı.
 */

const TICK_MS = 20_000;

let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeToClock(listener: () => void): () => void {
  /**
   * ABONE OLURKEN SAAT TAZELENİR. `now` modül yüklendiğinde ayarlanıyor;
   * uzun süre açık kalmış bir sekmede istemci tarafı gezinme ile açılan sayfa,
   * dakikalar öncesine ait bir değer okurdu. React abonelikten sonra anlık
   * görüntüyü zaten yeniden soruyor, yani tazelenen değer ilk çizime yetişiyor.
   */
  now = Date.now();
  listeners.add(listener);

  timer ??= setInterval(() => {
    now = Date.now();
    notify();
  }, TICK_MS);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Kararlı anlık görüntü — her çağrıda `Date.now()` okumak döngü üretirdi. */
export function readClock(): number {
  return now;
}

export function readClockOnServer(): null {
  return null;
}

/** Test yalıtımı: zamanlayıcıyı ve dinleyicileri sıfırlar. */
export function resetClock(): void {
  if (timer !== undefined) clearInterval(timer);
  timer = undefined;
  listeners.clear();
  now = Date.now();
}
