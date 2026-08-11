/**
 * Görünüm tercihi — PROJECT.md §7.12.
 *
 * ÜÇ DURUM VAR, İKİ DEĞİL. `system` öntanımlıdır ve işletim sistemi ayarını
 * izler; `light` ve `dark` onu geçersiz kılar. İki durumlu bir anahtar,
 * sistemi izleme davranışına GERİ DÖNMEYİ imkânsız kılardı — bir kez dokunan
 * kullanıcı ömür boyu elle seçmek zorunda kalırdı.
 *
 * NEDEN `localStorage`, ÇEREZ DEĞİL. Çerez her isteğe eklenir ve sayfa
 * HTML'ini isteğe göre değiştirirdi; §7.9'un "aynı URL herkese aynı cevabı
 * verir" niteliği zedelenirdi. Tercih, §9.1'in günlük oyun durumuyla aynı
 * sınıftadır ve aynı yerde durur.
 *
 * NEDEN `daily-storage` FABRİKASI KULLANILMIYOR. O fabrika bir TARİHE bağlı
 * kayıtlar için: gün dönünce kaydı atıyor ve JSON gövdeleri doğruluyor.
 * Görünüm tercihinin tarihi yok ve tek bir dizeden ibaret. Ama `localStorage`
 * yine bir DIŞ SİSTEM olduğu için aynı arayüz kuruluyor —
 * `useSyncExternalStore` React'in bu iş için tanımladığı yol: render sırasında
 * depoyu okumak sunucu ve istemci çıktısını ayrıştırır, efekt içinde okuyup
 * `setState` çağırmak basamaklı render üretir.
 */

export const THEME_CHOICES = ["system", "light", "dark"] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const THEME_STORAGE_KEY = "futbol-quiz:theme";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return (THEME_CHOICES as readonly unknown[]).includes(value);
}

/**
 * `<head>` içinde, İLK BOYAMADAN ÖNCE çalışan açılış script'i.
 *
 * NEDEN SATIR İÇİ SCRIPT. `useEffect` boyamadan SONRA çalışır (kullanıcı yanlış
 * temayı görür), `useLayoutEffect` hidrasyondan sonra çalışır (yavaş bağlantıda
 * tarayıcı sunucu HTML'ini çoktan boyamıştır). Yalnızca HTML AYRIŞTIRILIRKEN
 * çalışan bir script yanıp sönmeyi tümüyle kapatır. CSP'nin nonce'u tam olarak
 * bunun içindir (§7.3).
 *
 * DEPODAKİ DEĞER KÖRLEMESİNE YAZILMAZ: yalnızca iki bilinen dize kabul edilir.
 * Kurcalanmış bir kayıt özniteliğe rastgele içerik sokamaz. `try/catch`
 * deponun kapalı olduğu durumu (gizli mod, dolu kota) sessizce geçer — sayfa
 * yine açılır, yalnızca tercih hatırlanmaz.
 *
 * Anahtar buradan besleniyor; script ile okuyucunun ayrı dizeler taşıması
 * sessizce çalışmayan bir tercih üretirdi.
 */
export const THEME_BOOT_SCRIPT =
  `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
  `if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

/**
 * `undefined` = henüz okunmadı. Depoya her render'da gitmemek için tutuluyor;
 * ayrıca deponun kullanılamadığı durumun (gizli mod, dolu kota) yedeği —
 * tercih o oturum boyunca yine çalışır, yalnızca yenilemeye dayanmaz.
 */
let snapshot: ThemeChoice | undefined = undefined;
const listeners = new Set<() => void>();

export function subscribeToThemeChoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Depodan okur. Kayıt yoksa, bozuksa ya da depo kapalıysa `system`.
 *
 * DEPODAN GELEN VERİ DIŞ GİRDİDİR (§2.3): kullanıcı elle düzenleyebilir, eski
 * bir sürüm başka bir şey yazmış olabilir.
 */
export function readThemeChoice(): ThemeChoice {
  if (snapshot !== undefined) return snapshot;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    snapshot = isThemeChoice(raw) ? raw : "system";
  } catch {
    snapshot = "system";
  }
  return snapshot;
}

/**
 * Sunucuda depo YOKTUR ve öntanımlı davranış zaten sistemi izlemektir.
 * Hidrasyon geçişini React yönetir — SAYFANIN TEMASI bu geçişten
 * etkilenmez, onu `<head>`'deki açılış script'i ilk boyamadan önce basar.
 */
export function readThemeChoiceOnServer(): ThemeChoice {
  return "system";
}

/** Test yalıtımı: modül düzeyindeki anlık görüntüyü sıfırlar. */
export function resetThemeChoiceCache(): void {
  snapshot = undefined;
  listeners.clear();
}

/**
 * Seçimi belgeye uygular.
 *
 * `system` özniteliği KALDIRIR, "system" diye bir değer yazmaz: CSS'teki medya
 * sorgusu ancak öznitelik yokken devreye girer.
 */
export function applyThemeChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

/** Seçimi hem uygular hem saklar. Saklayamamak uygulamayı durdurmaz. */
export function writeThemeChoice(choice: ThemeChoice): void {
  applyThemeChoice(choice);
  snapshot = choice;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Depo kapalıysa tercih oturum boyunca geçerli olur, yenilemeye dayanmaz.
  }
  for (const listener of listeners) listener();
}
