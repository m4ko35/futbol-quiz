/**
 * Kulüp adı → iki harflik işaret — PROJECT.md §7.13, BR-35.
 *
 * NEDEN VERİ DEĞİL, TÜRETME. Bir alan olsaydı ETL adımı, göç ve tazeleme
 * yükümlülüğü getirirdi; oysa değer addan tamamen belirlenir. Saf tutulması
 * ayrıca test edilebilir yapıyor: aşağıdaki kural listesinin tamamı ölçülmüş
 * kulüp adlarından çıktı.
 *
 * NEDEN İKİ HARF. İşaret arayüzde 20 px kullanılıyor; üç harf o boyutta
 * okunmuyor, tek harf ise ayırt etmiyor ("Beşiktaş" ve "Bologna" aynı olurdu).
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
  // Parantezli ekler ayırt edici değil: "FC Karpaty Lviv (2020)" ile
  // "FC Karpaty Lviv" aynı işareti almalı.
  const cleaned = name.replace(/\([^)]*\)/gu, " ");

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

  const second = source[1];
  if (second !== undefined) {
    return upper(first.slice(0, 1) + second.slice(0, 1), country);
  }

  // Tek sözcük: iki harfi de ondan. Tek harfli adlarda o harf yalnız kalır.
  return upper(first.slice(0, 2), country);
}
