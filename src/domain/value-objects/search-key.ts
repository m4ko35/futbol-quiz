/**
 * Arama anahtarı: aksansız, küçük harfli, noktalama temizlenmiş.
 *
 * NEDEN BURADA, `domain/` içinde: bu anahtarı ETL ÜRETİR (`Club.searchKey`
 * sütununa yazar), repository ise ARAR. İki taraf farklı normalizasyon
 * uygularsa arama sessizce çalışmaz — "Beşiktaş" yazan kullanıcı hiçbir sonuç
 * almaz ve ortada hata mesajı olmadığı için sebebi görünmez. Tek bir yazılı
 * hâlin olması, bu sınıf hatanın imkânsız olması demektir.
 *
 * Türkçe'ye özel iki tuzak var:
 *   - "ı" (U+0131) Unicode NFD ile ayrışmaz, bu yüzden elle "i"ye eşlenir.
 *   - "İ" (U+0130) JavaScript'in varsayılan toLowerCase'i ile "i̇" (i +
 *     birleşik nokta) olur; bu da aramayı bozar. Önce elle eşleniyor.
 *
 *   "İstanbul Başakşehir FK" → "istanbul basaksehir fk"
 */
export function toSearchKey(value: string): string {
  return value
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "") // birleşik aksan işaretleri
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
