/**
 * Davetin giriş turundan sağ çıkması — PROJECT.md §12.
 *
 * ÇÖZDÜĞÜ KUSUR. Arkadaşı bağlantıyı gönderiyor, karşı taraf `/oda/{kod}`
 * adresini açıyor ama giriş yapmamış. Girişten sonra Google akışı kullanıcıyı
 * `/istatistik`'e bırakıyor (§11.10) ve kod kayboluyor: kullanıcı geri gidip
 * bağlantıyı yeniden bulmak zorunda kalıyordu.
 *
 * NEDEN OTURUM DEPOSU, NEDEN KİMLİK AKIŞI DEĞİL. Kodu OAuth `state`'ine
 * iliştirmek de mümkündü ama üç dosyaya ve ad seçme adımına (`/giris/ad`)
 * dokunmayı gerektirirdi — çalışan bir kimlik akışını, tamamen istemcide
 * çözülebilen bir kolaylık için genişletmek. Kod zaten kullanıcının kendi
 * adres çubuğunda yazılı; onu kendi sekmesinde saklamak yeni bir sır
 * yaratmıyor.
 *
 * `sessionStorage`, `localStorage` DEĞİL: davet o sekmeye ve o ana ait. Kalıcı
 * depoya yazılsaydı haftalar sonra açılan bir lobide çoktan sönmüş bir odanın
 * kodu belirirdi (BR-60).
 *
 * DIŞ SİSTEM ARAYÜZÜ — `daily-storage.ts` ile aynı gerekçe: depo React'in
 * bilmediği bir yerde yaşıyor, render sırasında okunamaz, efektte okunup
 * `setState` ile aktarılamaz. Okuma `useSyncExternalStore` üzerinden yapılıyor.
 *
 * DAVET OKUNDUĞUNDA DEĞİL, KULLANILDIĞINDA SİLİNİR. Okurken silmek "temiz"
 * görünüyordu ama okumanın kendisi bir olay değil: React anlık görüntüyü
 * istediği sıklıkta sorabilir ve ilk sorguda silinen bir davet ikinci sorguda
 * yok olurdu. Silme, kullanıcının odaya katılmasına bağlı.
 */

const KEY = "futbol-quiz:oda-daveti";

/**
 * `undefined` = henüz okunmadı, `null` = davet yok.
 *
 * Ayrım `daily-storage.ts`'teki ile aynı işi görüyor: anlık görüntü KARARLI
 * olmalı, yoksa React her render'da farklı bir değer görüp döngüye girer.
 */
let snapshot: string | null | undefined = undefined;
const listeners = new Set<() => void>();

export function subscribeToInvite(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readInvite(): string | null {
  if (snapshot !== undefined) return snapshot;

  try {
    snapshot = sessionStorage.getItem(KEY);
  } catch {
    // Gizli sekmede ya da depolama kapalıyken okunamaz. Davet bir kolaylık;
    // kaybolması akışı durdurmuyor, kullanıcı kodu elle yazabiliyor.
    snapshot = null;
  }

  return snapshot;
}

export function readInviteOnServer(): null {
  return null;
}

export function rememberInvite(code: string): void {
  snapshot = code;
  try {
    sessionStorage.setItem(KEY, code);
  } catch {
    // Aynı gerekçe: yazamamak akışı durdurmuyor.
  }
  for (const listener of listeners) listener();
}

export function clearInvite(): void {
  snapshot = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Aynı gerekçe.
  }
  for (const listener of listeners) listener();
}

/** Test yalıtımı: modül düzeyindeki anlık görüntüyü sıfırlar. */
export function resetInviteCache(): void {
  snapshot = undefined;
  listeners.clear();
}
