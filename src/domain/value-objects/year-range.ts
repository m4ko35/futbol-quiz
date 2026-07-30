/**
 * Bir dönemin kapsadığı sezon aralığı.
 *
 * Her iki uç da `null` olabilir ve `null` "bilinmiyor" demektir — asla "0" ya
 * da "bugün" değil (§2.7: belirsizlik veri kaybından iyidir). Wikidata'da
 * tarihsiz transfer kaydı yaygındır; uydurulmuş bir tarih, eksik tarihten çok
 * daha zararlıdır çünkü yanlış olduğu görünmez.
 */
export interface YearRange {
  readonly start: number | null;
  readonly end: number | null;
}

/**
 * İki dönemin zaman olarak örtüştüğünü **kanıtlayabiliyor muyuz?**
 *
 * Fonksiyon bilerek karamsardır: bilgi yetersizse `false` döner. "Örtüşüyor"
 * demek bir iddiadır ve bu iddia yalnızca veriye dayanarak kurulabiliyorsa
 * yapılır. Bilinmeyen bir uç, örtüşme lehine yorumlanmaz.
 *
 * Sınır davranışı: bir dönem 2012'de biterken diğeri 2012'de başlıyorsa
 * örtüşme YOKTUR. Sezon yılı bir ana değil bir aralığa karşılık gelir ve
 * transferin normal biçimi tam olarak budur — ayrılış yılı = katılış yılı.
 *
 * Kullanım: ETL'de çelişkili kalıcı dönemleri işaretlemek (§8.2) ve ileride
 * "aynı takımda birlikte oynadılar mı" türü oyun modları (§9).
 */
export function definitelyOverlaps(a: YearRange, b: YearRange): boolean {
  const aStart = a.start;
  const bStart = b.start;
  if (aStart === null || bStart === null) return false;

  // Erken başlayanı öne al; böylece tek bir karşılaştırma yeter.
  const earlyIsA = aStart <= bStart;
  const earlierEnd = earlyIsA ? a.end : b.end;
  const laterStart = earlyIsA ? bStart : aStart;

  // Erken dönemin bitişi bilinmiyorsa aralık açık uçludur; örtüşme iddia
  // edilemez. (Süregelen dönemler `Spell.isCurrent` ile ayrıca taşınır.)
  if (earlierEnd === null) return false;

  return laterStart < earlierEnd;
}

/**
 * Sıralama için kullanılabilir "en son bilinen yıl" (BR-5 ikincil anahtarı).
 *
 * Bitiş biliniyorsa o, yoksa başlangıç, ikisi de yoksa `null`.
 */
export function latestKnownYear(range: YearRange): number | null {
  return range.end ?? range.start;
}

/** Aralıkta hiç yıl bilgisi var mı? */
export function hasAnyYear(range: YearRange): boolean {
  return range.start !== null || range.end !== null;
}
