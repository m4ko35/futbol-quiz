/**
 * Günlük oyunların ilerlemesi — tarayıcı deposu (PROJECT.md §9.1, §9.2).
 *
 * NEDEN SAKLANIYOR: saklanmasaydı hak/deneme sınırları anlamsız kalırdı.
 * Sayfayı yenileyen kullanıcı sıfırdan başlar ve sınır hiçbir şeyi sınırlamaz.
 *
 * NEDEN SUNUCUDA DEĞİL: sunucu tarafı oyun durumu, oturum yönetimi ve kişisel
 * veri saklama demektir (§7.6). Bedeli, ilerlemenin kullanıcı tarafından
 * değiştirilebilir olmasıdır — şu an kazanılacak bir şey olmadığı için kabul
 * edildi. Skor tablosu (§9) eklendiğinde durum SUNUCUYA taşınmak zorundadır.
 *
 * NEDEN `useSyncExternalStore` UYUMLU BİR FABRİKA: `localStorage` bir DIŞ
 * SİSTEMDİR. Render sırasında okumak sunucu ve istemci çıktısını ayrıştırır
 * (sunucuda depo yoktur), efekt içinde okuyup `setState` çağırmak basamaklı
 * render üretir. React'in bu iş için tanımladığı arayüz `useSyncExternalStore`.
 *
 * NEDEN GENEL: iki oyun modu aynı mekanizmayı kullanıyor ve mekanizmanın
 * incelikleri (anlık görüntünün kararlılığı, sunucu görüntüsü, bozuk kayıt,
 * erişilemeyen depo) her kopyada yeniden doğru yazılmak zorunda kalırdı.
 * Ortak olan mekanizma; SAKLANAN ŞEKİL her modun kendi işidir ve doğrulaması
 * dışarıdan verilir.
 */

/** Her günlük oyunun sakladığı ortak alan. */
export interface DailyRecord {
  readonly date: string;
}

export interface DailyStore<T extends DailyRecord> {
  subscribe(listener: () => void): () => void;
  /** Kararlı anlık görüntü — React aynı değeri döndürmeyen okuyucuda döngüye girer. */
  read(): string | null;
  /** Sunucuda kaydedilmiş oyun YOKTUR; hidrasyon geçişini React yönetir. */
  readOnServer(): null;
  write(value: T): void;
  /** Ham metni doğrular ve BAŞKA GÜNE aitse `null` verir. */
  parse(raw: string | null, date: string): T | null;
  /** Test yalıtımı: modül düzeyindeki anlık görüntüyü sıfırlar. */
  reset(): void;
}

export function createDailyStore<T extends DailyRecord>(
  storageKey: string,
  isValid: (value: unknown) => value is T,
): DailyStore<T> {
  /**
   * `undefined` = henüz okunmadı, `null` = kayıt yok.
   *
   * Ayrım gerekli: `read()` her çağrıldığında depoya gitmek hem gereksiz hem
   * KARARSIZ olurdu. Bu değişken aynı zamanda deponun kullanılamadığı durumun
   * (gizli mod, dolu kota) yedeğidir — oyun oturum boyunca çalışır, yalnızca
   * yenilemeye dayanmaz.
   */
  let snapshot: string | null | undefined = undefined;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    read() {
      if (snapshot !== undefined) return snapshot;
      try {
        snapshot = window.localStorage.getItem(storageKey);
      } catch {
        // Depoya erişilemiyorsa oyun ÇÖKMEZ; ilerleme kalıcı olmaz.
        snapshot = null;
      }
      return snapshot;
    },

    readOnServer() {
      return null;
    },

    write(value) {
      const raw = JSON.stringify(value);
      snapshot = raw;
      try {
        window.localStorage.setItem(storageKey, raw);
      } catch {
        // Aynı gerekçe: saklayamamak oyunu durdurmaz.
      }
      for (const listener of listeners) listener();
    },

    parse(raw, date) {
      if (raw === null) return null;
      try {
        // DEPODAN GELEN VERİ DIŞ GİRDİDİR (§2.3): kullanıcı elle
        // düzenleyebilir, eski bir sürüm yazmış olabilir.
        const parsed: unknown = JSON.parse(raw);
        if (!isValid(parsed)) return null;
        return parsed.date === date ? parsed : null;
      } catch {
        return null;
      }
    },

    reset() {
      snapshot = undefined;
      listeners.clear();
    },
  };
}

/** Doğrulayıcılarda tekrar eden nesne denetimi. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
