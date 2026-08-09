/**
 * Kulüp adı → üç harflik işaret — PROJECT.md §7.13, BR-35.
 *
 * NEDEN VERİ DEĞİL, TÜRETME. Bir alan olsaydı ETL adımı, göç ve tazeleme
 * yükümlülüğü getirirdi; oysa değer addan tamamen belirlenir. Saf tutulması
 * ayrıca test edilebilir yapıyor: aşağıdaki kural listesinin tamamı ölçülmüş
 * kulüp adlarından çıktı.
 *
 * NEDEN ÜÇ HARF. İki harf ölçüldü ve yetmedi: işaret yalnızca ARMASIZ 510
 * kulüpte basılıyor ve onların %68,6'sı (350 kulüp) işaretini en az bir başka
 * kulüple paylaşıyordu — `BR` sekiz kulübe, `AC` ve `HA` yediye düşüyordu.
 * İşaret ayırt edici olmaktan çıkıp dokuya dönüşmüştü. Üç harf bu payı
 * **%14,5'e** indiriyor (ölçüm §7.13). Dört varyant karşılaştırıldı; buradaki
 * en az çakışanı.
 *
 * Üç harfin dayanağı KARO ÖLÇÜSÜDÜR: işaret 26 px basılıyor. Karo küçültülürse
 * karar yeniden ölçülmelidir — üç harf 20 px'te okunmuyordu, iki harfin ilk
 * gerekçesi buydu.
 */

/**
 * Kulüp TÜRÜ bildiren kısaltmalar — kimlik taşımazlar.
 *
 * NEDEN ATILIYOR: "Genoa CFC" → `GC` kulübü değil, kulüp türünü heceler.
 * Bunlar atılınca `GE` kalır ve ad okunur hâle gelir.
 *
 * LİSTE KISA TUTULDU ve yalnızca AYRI SÖZCÜK olarak eşleşir. Uzun bir liste,
 * adın kendisi olan kısaltmaları yutardı: `AEK`, `IFK`, `PSV`, `AZ` birer
 * kulüp adıdır, tür bildirimi değil.
 */
const CLUB_TYPE_WORDS = new Set([
  "fc",
  "cf",
  "cfc",
  "sc",
  "ac",
  "as",
  "sk",
  "fk",
  "nk",
  "cd",
  "ud",
  "bk",
  "sv",
  "ca",
  "rc",
  "sd",
  "afc",
  "kfc",
  "vfb",
  "vfl",
  "tsv",
  "fsv",
  // İskandinav tür ekleri. `IFK` KASTEN yok: o bir kulüp adının parçası
  // ("IFK Göteborg") ve eşleşme tam sözcük olduğu için `if` onu yutmuyor.
  "if",
  "aif",
  "ik",
  "ff",
  "spor",
  "kulübü",
  "kulubu",
]);

/**
 * Noktalı `İ` kullanan yazı sistemleri.
 *
 * `"i".toUpperCase()` JavaScript'te `"I"` verir, `"İ"` değil — Türkçe için
 * yanlış. Ama düzeltme HER ADA UYGULANAMAZ: ölçüldü, `toLocaleUpperCase("tr")`
 * yabancı adları bozuyor ve `AC Milan` işareti `Mİ` çıkıyor. Sitedeki 906
 * kulübün yalnızca 41'i Türk; kuralı topyekûn uygulamak çoğunluğu bozardı.
 *
 * Ayrım kulübün ÜLKESİNE bakılarak yapılıyor: veri zaten elimizde ve doğru
 * cevabı taşıyan tek alan o. Böylece `Sivasspor` → `Sİ`, `AC Milan` → `MI`.
 */
const DOTTED_I_COUNTRIES = new Set(["TR", "AZ"]);

function upper(text: string, country: string | null | undefined): string {
  return country !== null &&
    country !== undefined &&
    DOTTED_I_COUNTRIES.has(country.toUpperCase())
    ? text.toLocaleUpperCase("tr")
    : text.toUpperCase();
}

/**
 * Ad → işaret metni.
 *
 * Boş ya da yalnızca tür kısaltmasından oluşan adlarda `"?"` döner; çağıran
 * tarafın ayrıca boş durum düşünmesi gerekmesin diye asla boş dize dönmez.
 *
 * @param country ISO 3166-1 alpha-2; yalnızca büyük harf kuralını seçer.
 */
export function clubInitials(name: string, country?: string | null): string {
  // Noktalı kısaltmalar önce BİRLEŞTİRİLİR: "A.C. Carpi" ayrıştırıcıda
  // `A` + `C` + `Carpi` olarak üç sözcüğe bölünüyordu ve ne `A` ne `C` tür
  // listesinde olmadığı için ikisi de ayırt edici sayılıyordu — sonuç `ACC`.
  // Birleştirilince tür listesi işini görüyor: `AC` atılır, `CAR` kalır.
  const joined = name.replace(/\b(?:\p{L}\.){2,}/gu, (run) =>
    run.replaceAll(".", ""),
  );

  // Parantezli ekler ayırt edici değil: "FC Karpaty Lviv (2020)" ile
  // "FC Karpaty Lviv" aynı işareti almalı.
  const cleaned = joined.replace(/\([^)]*\)/gu, " ");

  const words = cleaned
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);

  // Sıra numaraları ("1. FK Příbram") ve tür kısaltmaları elenir.
  //
  // KÜÇÜK HARFE ÇEVİRME YERELSİZ. Türkçe yerel burada KULLANILAMAZ:
  // `"IF".toLocaleLowerCase("tr")` noktasız `"ıf"` verir ve liste hiç
  // eşleşmez — testte tam olarak böyle yakalandı (`Gefle IF` → `GI`).
  // Yerel duyarlı çevirme yalnızca GÖSTERİLEN metne uygulanır (§7.13).
  const significant = words.filter(
    (word) => !CLUB_TYPE_WORDS.has(word.toLowerCase()) && !/^\d+$/u.test(word),
  );

  // Hepsi elendiyse elde kalanla çalışılır — işaret üretmemektense
  // ayırt ediciliği düşük bir işaret üretmek yeğdir.
  const source = significant.length > 0 ? significant : words;

  const first = source[0];
  if (first === undefined) return "?";

  // Tek sözcük: üç harfi de ondan. Kısa adlarda daha az harf kalır.
  const second = source[1];
  if (second === undefined) return upper(first.slice(0, 3), country);

  // İKİ SÖZCÜKTE İLK SÖZCÜKTEN İKİ HARF. Her sözcükten birer harf almak
  // (`Swansea City` → `SC`, `Stoke City` → `SC`) ölçümde çakışmayı %27,3'te
  // bırakıyordu; bu kural %14,5'e indiriyor — `SWC` / `STC`. İkinci sözcük
  // çoğu adda ortak bir sözcüktür ("City", "United", "Rovers") ve ayırt eden
  // bilgi birincidedir.
  const third = source[2];
  if (third === undefined) {
    return upper(first.slice(0, 2) + second.slice(0, 1), country);
  }

  // Üç ve daha fazla sözcük: her birinden birer harf.
  return upper(
    first.slice(0, 1) + second.slice(0, 1) + third.slice(0, 1),
    country,
  );
}
