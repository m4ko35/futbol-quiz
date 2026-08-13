/**
 * `birthDate` → doğum YILI — PROJECT.md §9.2.
 *
 * NEDEN AYRI SÜTUN DEĞİL. Yıl, saklanan tarihten türetilebilir; ayrı bir sütun
 * ikinci bir doğruluk kaynağı olur ve şema göçü artı tam bir ETL koşusu
 * isterdi. Kilo yerine doğum yılı konurken bunların hiçbiri gerekmedi.
 *
 * NEDEN `getUTCFullYear`, `getFullYear` DEĞİL — ÖLÇÜLDÜ. Tarihler gün
 * başlangıcında UTC olarak saklanıyor; yerel saatle okunduğunda gün geriye
 * kayabiliyor. Bu makinede 1903 doğumlu bir oyuncunun tarihi yerel saatte
 * `1903-01-31 01:56` görünüyor (İstanbul'un o tarihteki +01:56 farkı). Negatif
 * farklı bir dilimde aynı okuma 31 Aralık'a düşer ve yıl BİR EKSİK çıkar —
 * yani sunucunun bulunduğu yere göre değişen bir oyun değeri. UTC bunu
 * kapatır.
 */
export function yearOf(birthDate: Date): number;
export function yearOf(birthDate: Date | null): number | null;
export function yearOf(birthDate: Date | null): number | null {
  return birthDate === null ? null : birthDate.getUTCFullYear();
}
