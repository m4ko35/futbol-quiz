/**
 * Görünen ad bildiriminin sebebi — PROJECT.md §11.12, BR-53.
 *
 * ÜÇ SEBEP UYDURULMADI: §11.2'nin T5 tehdidi zaten tam olarak bunları
 * adlandırıyor — _"kullanıcı adı hakaret, taklit veya reklam taşıyabilir"_.
 * Listeyi tehditten türetmek, bir gün "acaba dördüncü bir kategori mi lazım"
 * sorusunun cevabını da belirliyor: önce tehdit modeli değişmeli.
 *
 * SERBEST METİN ALANI YOK ve bu, listenin var olma sebebi. Serbest metin
 * bildirimi İKİNCİ BİR HAKARET KANALINA çevirirdi: birinin adına küfredemeyen
 * kişi, o kişiyi bildirirken küfreder ve metni işletmeci okur. Kapalı bir liste
 * o sınıfın tamamını kapatıyor.
 *
 * Bedeli kabul edildi: "başka bir sebep" diyemeyen kullanıcı en yakın sebebi
 * seçer. Üç kategori karar için yeterli bağlam veriyor — asıl kanıt zaten
 * ADIN KENDİSİ, bildirimin metni değil.
 */

export const REPORT_REASONS = ["hakaret", "taklit", "reklam"] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** Sınırda doğrulama için (§2.3). */
export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

/**
 * Kullanıcıya gösterilen etiketler.
 *
 * Alan katmanında duruyorlar çünkü sebep listesiyle BİRLİKTE değişmeleri
 * gerekir; ayrı bir dosyada dursalardı yeni bir sebep eklenip etiketi
 * unutulabilirdi. `displayNameRejectionMessage` ile aynı gerekçe.
 */
export const REPORT_REASON_LABELS: Readonly<Record<ReportReason, string>> = {
  hakaret: "Hakaret veya küfür",
  taklit: "Başkasıymış gibi görünüyor",
  reklam: "Reklam veya bağlantı",
};
