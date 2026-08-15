/**
 * Günlük ızgara tohumu ve deterministik rastgelelik — PROJECT.md §9.1 (BR-11).
 *
 * NEDEN DETERMİNİSTİK. İki sebep, ikisi de mimariye bağlı:
 *
 * 1. Rastgele bir ızgara CDN önbelleğini işlevsiz kılardı (§7.9). Aynı gün
 *    aynı cevap dönüyorsa yanıt önbelleklenebilir; her istekte farklı ızgara
 *    üretilseydi her istek fonksiyona ulaşırdı.
 * 2. Skor tablosu (§9) ancak herkes aynı soruyu çözerse anlamlıdır.
 *
 * `Math.random()` KULLANILMAZ: hem tekrarlanabilir değildir hem de test
 * edilemez. Aynı gün, aynı ızgara — bu bir davranış, bir tesadüf değil.
 */

/**
 * Bulmaca gününün dilimi ve dönme saati — BR-49.
 *
 * DİLİM ADI KULLANILIR, SABİT KAYDIRMA DEĞİL. Türkiye 2016'dan beri yaz saati
 * uygulamıyor, yani bugün `Europe/Istanbul` ile sabit `+3` aynı sonucu verir.
 * Yine de ad kullanılıyor: yaz saati geri gelirse sabit kaydırma **sessizce**
 * yanlış güne kayar ve bunu hiçbir test yakalamaz, çünkü testler de aynı
 * sabiti kullanır. Ad kullanmak, kararı çalışma zamanının dilim veritabanına
 * bırakır.
 *
 * `Intl` bir JavaScript yerleşiğidir, bağımlılık değil — §2.1'in "domain
 * hiçbir şeye bağımlı olamaz" kuralı korunuyor.
 */
export const PUZZLE_TIME_ZONE = "Europe/Istanbul";

/**
 * Bulmacanın döndüğü yerel saat — BR-49.
 *
 * ÖNCE UTC GECE YARISIYDI ve bu Türkiye'de 03:00'e denk geliyordu: gece
 * yarısı oynayan kullanıcı hâlâ "dünkü" bulmacadaydı. 06:00 ürün sahibi
 * kararıdır (15 Ağustos 2026).
 */
export const PUZZLE_ROLLOVER_HOUR = 6;

/** Verilen anın, hedef dilimdeki duvar saati alanları. */
interface WallClock {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: PUZZLE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function wallClock(date: Date): WallClock {
  const parts = new Map<string, string>(
    FORMATTER.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const read = (type: string): number => Number(parts.get(type) ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * Dilimin o andaki UTC farkı, milisaniye.
 *
 * Duvar saatini UTC'ymiş gibi okuyup gerçek anla farkını alır. Yaz saati
 * geçişlerinde fark değişir; bu yüzden çağrı başına yeniden hesaplanır.
 */
function zoneOffsetMs(date: Date): number {
  const w = wallClock(date);
  const asUtc = Date.UTC(
    w.year,
    w.month - 1,
    w.day,
    w.hour,
    w.minute,
    w.second,
  );
  // Saniye altı kalıntı farkı bozmasın; dilim farkları dakika çözünürlüklüdür.
  return asUtc - date.getTime() + (date.getTime() % 1_000);
}

/** Bulmaca gününün takvim alanları — dönme saatinden ÖNCESİ önceki güne yazılır. */
function puzzleDayParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const w = wallClock(date);

  // Takvim aritmetiği UTC üzerinden yapılır; burada UTC bir zaman dilimi
  // değil, gün/ay/yıl taşmasını doğru yapan bir araçtır.
  const shifted = new Date(
    Date.UTC(w.year, w.month - 1, w.day) -
      (w.hour < PUZZLE_ROLLOVER_HOUR ? 86_400_000 : 0),
  );

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * Tarihten gün tohumu — BR-49.
 *
 * NEDEN SABİT BİR DİLİM. Sunucunun yerel dilimi bir dağıtım tesadüfüdür;
 * sabitlenmeseydi ızgara, hangi bölgedeki sunucunun yanıt verdiğine göre
 * değişebilirdi — yani "herkes aynı ızgarayı görür" kuralı (BR-11) sessizce
 * bozulurdu.
 *
 * NEDEN UTC DEĞİL. Dilim UTC'ydi ve gün UTC gece yarısında dönüyordu; bu
 * Türkiye'de 03:00 demekti. Lider tablosu (§11) gelince bu sınır bir ürün
 * kararına dönüştü ve 06:00 seçildi.
 */
export function dailySeed(date: Date): number {
  const { year, month, day } = puzzleDayParts(date);
  return year * 10_000 + month * 100 + day;
}

/**
 * Bulmacanın bir sonraki dönme anı — §11.7'nin önbellek kusurunun onarımı.
 *
 * NEDEN GEREKLİ, ölçüldü. Günlük uçlar (`/api/grid`, `/api/stat-match`)
 * öntanımlı `s-maxage=86400` alıyordu ve o başlığın gerekçesi futbol verisine
 * aitti ("yılda iki kez değişir, her değişim bir dağıtımla gelir"). Günlük
 * bulmaca için geçerli değil: her gün değişiyor ve arada dağıtım yok. Sabah
 * 10:00'da önbelleğe giren yanıt ertesi sabah 10:00'a kadar taze sayılıyordu,
 * yani gün sınırını 24 saate kadar aşabiliyordu.
 *
 * SABİT BİR SAYI YETMEZ: kalan süre isteğin saatine bağlıdır.
 *
 * FARK İKİ KEZ HESAPLANIR. Yaz saati geçişi tam da sınırın üstündeyse ilk
 * hesap yanlış anı verir; aday anın kendi farkıyla düzeltilir. Türkiye'de
 * bugün geçiş yok, ama kural dilim adına dayandığı için kod da dayanmalı.
 */
export function nextRollover(date: Date): Date {
  const offset = zoneOffsetMs(date);
  const w = wallClock(date);

  const rollsToday = w.hour < PUZZLE_ROLLOVER_HOUR;
  const wallTarget =
    Date.UTC(w.year, w.month - 1, w.day, PUZZLE_ROLLOVER_HOUR) +
    (rollsToday ? 0 : 86_400_000);

  const firstGuess = wallTarget - offset;
  const corrected = wallTarget - zoneOffsetMs(new Date(firstGuess));

  return new Date(corrected);
}

/** Aynı günün ızgarası bir kez üretilemezse denenecek alternatif tohumlar. */
export function seedVariant(seed: number, attempt: number): number {
  return seed * 1_000 + attempt;
}

/**
 * mulberry32 — küçük, hızlı, deterministik sözde-rastgele üreteç.
 *
 * Kriptografik DEĞİLDİR ve olması da gerekmez: burada üretilen şey bir sır
 * değil, herkese açık bir bulmacadır. Yerel yazılmasının sebebi §7.7'deki
 * bağımlılık disiplini — on satırlık bir iş için paket eklenmez.
 */
export function createRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Diziyi deterministik olarak karıştırır (Fisher–Yates).
 *
 * Girdi DEĞİŞTİRİLMEZ: çağıranın elindeki havuz listesi, üretim denemeleri
 * arasında sabit kalmalı.
 */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}
