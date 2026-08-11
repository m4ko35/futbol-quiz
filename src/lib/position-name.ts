/**
 * Mevki anahtarı → Türkçe ad — PROJECT.md §6.2, BR-40.
 *
 * NEDEN BU DOSYA VAR. Veritabanı dilden bağımsız anahtar saklar
 * (`goalkeeper`, `defender`…); kullanıcıya gösterilecek metin burada üretilir.
 * Eskiden çeviri ETL'de yapılıyor ve Türkçe değer veritabanına yazılıyordu —
 * bir katman hatasıydı ve maliyeti ölçüldü: beş kelimeyi çevirmek için tam bir
 * ETL koşusu (~2 saat) artı veri göçü gerekiyordu.
 *
 * NEDEN `Intl` DEĞİL. Ülke adlarında (`country-name.ts`) CLDR verisi
 * kullanılabiliyor çünkü ISO ülke kodları standart. Futbol mevkilerinin böyle
 * bir standardı yok; küme bu projeye ait ve beş elemanlı, dolayısıyla eşleme
 * elle yazılır. Kümenin kendisi `scripts/etl/pipeline/normalize.ts` içindeki
 * `POSITIONS` ile aynıdır ve `db:verify` veri tarafını denetler (§8.2).
 */

const NAMES: Readonly<Record<string, string>> = {
  goalkeeper: "Kaleci",
  defender: "Defans",
  midfielder: "Orta saha",
  winger: "Kanat",
  forward: "Forvet",
};

/**
 * Mevkinin Türkçe adı; anahtar tanınmazsa `null`.
 *
 * TANINMAYAN ANAHTARDA HAM DEĞER DÖNDÜRÜLMEZ. `goalkeeper` gibi bir anahtarı
 * kullanıcıya olduğu gibi göstermek, çevirinin unutulduğu yerleri sessiz
 * kılardı; `null` dönmek onları görünür yapar (§2.7 ile aynı yön: yanlış
 * gösterimden yokluk iyidir).
 */
export function positionName(key: string | null): string | null {
  if (key === null) return null;
  return NAMES[key] ?? null;
}

/** Test ve doğrulama için; üretim kodu doğrudan çağırmaz. */
export function knownPositionKeys(): readonly string[] {
  return Object.keys(NAMES);
}
