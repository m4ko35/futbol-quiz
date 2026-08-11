/**
 * Lig → bayrak dosyası eşlemesi — PROJECT.md §7.14, BR-39.
 *
 * NEDEN ÜLKE KODU TEK BAŞINA YETMİYOR. Ölçüldü: `GB` kodu iki lige birden
 * düşüyor — Premier League (`Q9448`) ve İskoçya Premier Ligi (`Q14377162`).
 * İkisine aynı bayrağı basmak bayrağın VAR OLMA SEBEBİNİ yok eder: yirmi dört
 * satırlık listede ayırt etmek için konuyor. Futbol da İngiltere ile
 * İskoçya'yı ayrı uluslar sayar.
 *
 * İSTİSNA LİGE BAĞLIDIR, ÜLKEYE DEĞİL. `GB` kodunun kendisi doğru; yanlış
 * olan onu tek bir bayrağa eşlemek. Bu yüzden anahtar lig QID'idir — ve QID
 * seçilmesinin gerekçesi BR-37'yle aynı: veritabanı kimlikleri her ETL
 * koşusunda değişir, QID değişmez.
 *
 * NEDEN EMOJİ DEĞİL. Emoji bayrak sıfır maliyetlidir ama Windows'ta Chrome ve
 * Edge bayrak glifi taşımaz; iki harf gösterir. Yani aynı kod, aynı işletim
 * sisteminde tarayıcıya göre farklı sonuç verir. Bir oyun arayüzünde "bazı
 * kullanıcılarda bozuk" kabul edilebilir değil.
 */

/**
 * Lig QID'ine bağlı bayrak istisnaları (BR-39).
 *
 * Yeni bir istisna eklenecekse gerekçesi ÖLÇÜLMÜŞ olmalı: "ülke kodu bu ligin
 * bayrağını yanlış gösteriyor" cümlesi bir veri gözlemine dayanmalı, tercihe
 * değil.
 */
const LEAGUE_FLAG_OVERRIDES: Readonly<Record<string, string>> = {
  Q9448: "gb-eng", // Premier League — İngiltere
  Q14377162: "gb-sct", // İskoçya Premier Ligi — İskoçya
};

/**
 * `public/flags/` altında karşılığı olan kodlar.
 *
 * ELLE TUTULAN BİR LİSTE ve bu bilinçli: dosya sisteminden okumak sunucu
 * tarafı bir iş olurdu, oysa bu bilgi istemci bileşeninde gerekiyor. Listenin
 * veriyle uyumu bir testle tutuluyor (§7.14) — veritabanındaki her lig
 * ülkesinin burada karşılığı olduğu doğrulanıyor, yani liste sessizce
 * eskiyemez.
 */
const AVAILABLE_FLAGS: ReadonlySet<string> = new Set([
  "at",
  "be",
  "ch",
  "cz",
  "de",
  "dk",
  "es",
  "fr",
  "gb",
  "gb-eng",
  "gb-sct",
  "gr",
  "hr",
  "it",
  "nl",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sa",
  "se",
  "tr",
  "ua",
  "us",
]);

export interface FlagSubject {
  /** Lig QID'i — istisna tablosunun anahtarı. */
  readonly wikidataId: string;
  /** ISO 3166-1 alpha-2. */
  readonly country: string;
}

/**
 * Ligin bayrak kodunu verir; dosyası yoksa `null`.
 *
 * `null` dönmek bir hata değil, dürüst bir cevap: olmayan bir dosyaya `src`
 * vermek kırık görsel simgesi gösterirdi ve bu, boş yuvadan kötüdür (§7.13).
 */
export function flagCodeFor(league: FlagSubject): string | null {
  const override = LEAGUE_FLAG_OVERRIDES[league.wikidataId];
  if (override !== undefined) return override;

  const code = league.country.trim().toLowerCase();
  return AVAILABLE_FLAGS.has(code) ? code : null;
}

/** Bayrak dosyasının herkese açık yolu. */
export function flagUrl(code: string): string {
  return `/flags/${code}.svg`;
}

/** Test ve doğrulama için; üretim kodu doğrudan çağırmaz. */
export function availableFlagCodes(): readonly string[] {
  return [...AVAILABLE_FLAGS].sort();
}
