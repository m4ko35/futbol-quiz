/**
 * Izgara oyununun ilerlemesi — tarayıcı deposu (PROJECT.md §9.1).
 *
 * NEDEN SAKLANIYOR: saklanmasaydı BR-13'ün "dokuz hak" kuralı anlamsız olurdu.
 * Sayfayı yenileyen kullanıcı sıfırdan başlar, sınır da hiçbir şey sınırlamazdı.
 *
 * NEDEN SUNUCUDA DEĞİL: sunucu tarafı oyun durumu, oturum yönetimi ve kişisel
 * veri saklama demektir. İlerleme kullanıcının kendi tarayıcısında kalırsa
 * sunucu hiçbir kişisel veri tutmaz. Bunun bedeli, ilerlemenin kullanıcı
 * tarafından değiştirilebilir olmasıdır — şu an kazanılacak bir şey olmadığı
 * için (skor kaydı yok, sıralama yok) kabul edilebilir bir bedel. §9'daki skor
 * tablosu eklendiğinde oyun durumu SUNUCUYA taşınmak ZORUNDADIR.
 *
 * NEDEN AYRI BİR MODÜL VE `useSyncExternalStore` UYUMLU: `localStorage` bir DIŞ
 * SİSTEMDİR. Render sırasında okumak sunucu ve istemci çıktısını ayrıştırır
 * (sunucuda depo yoktur), efekt içinde okuyup `setState` çağırmak ise basamaklı
 * render üretir. React'in bu iş için tanımladığı arayüz `useSyncExternalStore`
 * ve bu modül onun sözleşmesini karşılar: `subscribe`, kararlı bir `getSnapshot`
 * ve ayrı bir sunucu anlık görüntüsü.
 */

export type CellState =
  | {
      readonly status: "correct";
      readonly playerId: string;
      readonly playerName: string;
    }
  | {
      readonly status: "wrong";
      readonly playerId: string;
      readonly playerName: string;
    };

export interface GameState {
  /** Hangi güne ait — gün dönünce kaydedilmiş oyun atılır (BR-11). */
  readonly date: string;
  readonly cells: Readonly<Record<string, CellState>>;
  readonly guessesUsed: number;
}

const STORAGE_KEY = "futbol-quiz:grid";

/**
 * Bellekteki anlık görüntü.
 *
 * `undefined` "henüz okunmadı" demektir; `null` "kayıt yok". Ayrım gerekli:
 * `getSnapshot` her çağrıldığında depoya gitmek hem gereksiz hem de KARARSIZ
 * olurdu — React aynı değeri döndürmeyen bir `getSnapshot`'ta sonsuz döngüye
 * girer.
 *
 * Bu değişken aynı zamanda deponun kullanılamadığı durumun (gizli mod, dolu
 * kota) yedeğidir: yazma başarısız olsa bile oyun oturum boyunca çalışır,
 * yalnızca yenilemeye dayanmaz.
 */
let snapshot: string | null | undefined = undefined;

const listeners = new Set<() => void>();

export function subscribeToSavedGame(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readSavedGame(): string | null {
  if (snapshot !== undefined) return snapshot;

  try {
    snapshot = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Depoya erişilemiyorsa oyun ÇÖKMEZ; ilerleme yalnızca kalıcı olmaz.
    snapshot = null;
  }
  return snapshot;
}

/**
 * Sunucuda kaydedilmiş oyun YOKTUR.
 *
 * Ayrı bir sunucu anlık görüntüsü vermek zorunlu: sunucu boş ızgarayı render
 * eder, istemci hidrasyondan sonra kaydı okur ve React geçişi kendisi yönetir.
 */
export function readSavedGameOnServer(): null {
  return null;
}

export function writeSavedGame(state: GameState): void {
  const raw = JSON.stringify(state);
  snapshot = raw;

  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Aynı gerekçe: saklayamamak oyunu durdurmaz.
  }

  for (const listener of listeners) listener();
}

/**
 * Ham metni oyun durumuna çevirir; başka bir güne aitse `null` döner.
 *
 * DEPODAN GELEN VERİ DIŞ GİRDİDİR (§2.3): kullanıcı elle düzenleyebilir, eski
 * bir sürüm yazmış olabilir. Şekli denetlenmeden kullanılmaz — bozuk bir kayıt
 * `cells` üzerinde dönerken çökerdi.
 */
export function parseSavedGame(
  raw: string | null,
  date: string,
): GameState | null {
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isGameState(parsed)) return null;
    return parsed.date === date ? parsed : null;
  } catch {
    return null;
  }
}

function isGameState(value: unknown): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (typeof candidate["date"] !== "string") return false;
  if (typeof candidate["guessesUsed"] !== "number") return false;
  if (!Number.isInteger(candidate["guessesUsed"])) return false;

  const cells = candidate["cells"];
  if (typeof cells !== "object" || cells === null || Array.isArray(cells)) {
    return false;
  }

  return Object.values(cells as Record<string, unknown>).every((cell) => {
    if (typeof cell !== "object" || cell === null) return false;
    const entry = cell as Record<string, unknown>;
    return (
      (entry["status"] === "correct" || entry["status"] === "wrong") &&
      typeof entry["playerId"] === "string" &&
      typeof entry["playerName"] === "string"
    );
  });
}

/** Test yalıtımı: modül düzeyindeki anlık görüntüyü sıfırlar. */
export function resetSavedGameCache(): void {
  snapshot = undefined;
  listeners.clear();
}
