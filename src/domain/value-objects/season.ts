import { InvalidSeasonDateError } from "../errors/domain-error";

/**
 * Sezon normalizasyonu — PROJECT.md BR-6.
 *
 * Wikidata transfer tarihlerini gün hassasiyetinde verir ("2011-08-15"), ama
 * futbolda anlamlı birim sezondur. Avrupa sezonları yaz ortasında başlayıp
 * ertesi ilkbaharda bittiği için takvim yılı tek başına yanıltıcıdır: Ocak
 * ayında yapılan bir transfer, bir önceki yaz başlayan sezona aittir.
 */

/** Sezonun başladığı kabul edilen ay (1 = Ocak). */
export const SEASON_START_MONTH = 7;

/** Makul kabul edilen en erken sezon yılı (§8.2 doğruluk denetimi). */
export const EARLIEST_SEASON_YEAR = 1850;

/**
 * Bir takvim tarihini ait olduğu sezonun BAŞLANGIÇ yılına indirger.
 *
 *   2011-08-15 → 2011  (2011/12 sezonu, yaz transferi)
 *   2012-01-31 → 2011  (hâlâ 2011/12 sezonu, kış transferi)
 *
 * @throws {InvalidSeasonDateError} tarih ayrıştırılamazsa
 */
export function toSeasonYear(date: Date): number {
  if (Number.isNaN(date.getTime())) {
    throw new InvalidSeasonDateError("tarih ayrıştırılamadı (Invalid Date)");
  }

  // UTC alıcıları kullanılıyor: sonuç sunucunun saat dilimine göre kaymamalı.
  // Yerel alıcılarla, UTC+3'teki bir sunucu 30 Haziran 22:00'ı 1 Temmuz sayıp
  // oyuncuyu yanlış sezona yazardı.
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  return month >= SEASON_START_MONTH ? year : year - 1;
}

/**
 * Sezon yılını gösterim biçimine çevirir: 2011 → "2011/12".
 *
 * @throws {InvalidSeasonDateError} yıl tam sayı değilse
 */
export function formatSeason(seasonYear: number): string {
  if (!Number.isInteger(seasonYear)) {
    throw new InvalidSeasonDateError(
      `sezon yılı tam sayı olmalı, alınan: ${seasonYear}`,
    );
  }

  // Yüzyıl dönümü: 1999 → "1999/00", bu yüzden mod 100 ve başa sıfır.
  const endYear = String((seasonYear + 1) % 100).padStart(2, "0");
  return `${seasonYear}/${endYear}`;
}

/** §8.2: yıl aralığı denetimi. Bu aralık dışı kayıt ETL'de reddedilir. */
export function isPlausibleSeasonYear(
  seasonYear: number,
  now: Date = new Date(),
): boolean {
  if (!Number.isInteger(seasonYear)) return false;
  return (
    seasonYear >= EARLIEST_SEASON_YEAR && seasonYear <= now.getUTCFullYear() + 1
  );
}
