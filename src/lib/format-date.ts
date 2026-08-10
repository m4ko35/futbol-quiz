/**
 * Türkçe tarih biçimlendirme — tek kaynak.
 *
 * NEDEN ORTAK. Aynı biçimlendirici üç yerde ayrı ayrı yazılmıştı (altbilgi,
 * ızgara sayfası, istatistik sayfası) ve üçü de aynı gerekçeyi yorum olarak
 * tekrarlıyordu. Üç kopya, üçünün ayrışması demektir; birinde `timeZone`
 * unutulsa kimse fark etmezdi.
 *
 * ZAMAN DİLİMİ UTC'YE SABİT — bu bir tercih değil, bir doğruluk koşulu.
 * Sunucunun yerel dilimi bir ürün kararı değil, bir dağıtım tesadüfüdür.
 * `new Date("2026-07-31")` UTC gece yarısı olarak ayrıştırılır; biçimlendirme
 * UTC'ye sabitlenmezse gün hassasiyetindeki bir tarih kullanıcıya BİR GÜN
 * ÖNCESİ olarak görünebilir. Günlük ızgara ve günün oyuncusu tam olarak bu
 * hassasiyette çalışıyor.
 */

const FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** `Date` → "30 Temmuz 2026". */
export function formatTurkishDate(date: Date): string {
  return FORMATTER.format(date);
}

/** `"2026-07-30"` → "30 Temmuz 2026". */
export function formatTurkishIsoDate(isoDate: string): string {
  return FORMATTER.format(new Date(isoDate));
}
