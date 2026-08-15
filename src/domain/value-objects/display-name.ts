import { toSearchKey } from "./search-key";

/**
 * Lider tablosunda görünen ad — PROJECT.md §11, BR-46.
 *
 * NEDEN KULLANICI SEÇER. Google bize hesabın gerçek adını döner ve onu
 * otomatik kullanmak, insanların GERÇEK İSİMLERİNİ istemeden herkese açık bir
 * listeye yazmak olurdu. Ad, hesap açarken kullanıcının kendi seçimidir.
 *
 * NEDEN SESSİZCE DÜZELTİLMEZ. Reddedilen bir adı kırpıp kabul etmek, kullanıcının
 * seçmediği bir adla listede görünmesi demektir. Bu modül **karar verir ve
 * gerekçesini döner**; düzeltmeyi kullanıcı yapar.
 */

/**
 * Uzunluk sınırları.
 *
 * ALT SINIR 3: iki harfli adlar tabloda ayırt edilemez ve tek harfli adlar
 * (özellikle "a", "x") kapılma yarışına dönüşür.
 *
 * ÜST SINIR 20: sınır bir ÖLÇÜM DEĞİL, yerleşim kararıdır — tablo satırı dar
 * ekranda taşmamalı. Değiştirilirse arayüzle birlikte değiştirilmelidir.
 */
export const DISPLAY_NAME_MIN_LENGTH = 3;
export const DISPLAY_NAME_MAX_LENGTH = 20;

/**
 * İzin verilen karakterler: Türkçe harfler, rakamlar, boşluk, `-` ve `_`.
 *
 * BEYAZ LİSTE, KARA LİSTE DEĞİL — ve bu yapısal bir güvenlik kararıdır.
 * Herkese açık bir tabloda asıl tehlike taklit: Kiril "М" (U+041C) Latin "M"
 * ile ekranda AYNI görünür, yani kara listeyle "Mehmet"i koruyan bir kural
 * "Мehmet"i geçirir. Sıfır genişlikli karakterler (U+200B) ve yön değiştirme
 * işaretleri (U+202E) de aynı sınıftan: gözle görülmezler, adı istedikleri
 * gibi gösterirler.
 *
 * Beyaz liste bu ailenin TAMAMINI tek kuralla kapatır — tek tek saymadan.
 * Bedeli emojidir ve kabul edilmiştir: emoji taşıyan ad reddedilir.
 */
const ALLOWED = /^[\p{Script=Latin}\p{Nd} _-]+$/u;

/** Ad EN AZ bir harf taşımalı; "123", "---" ad değildir. */
const HAS_LETTER = /\p{Script=Latin}/u;

/**
 * Sahiplenilemeyecek adlar — sitenin kendisini ya da yetkisini taklit edenler.
 *
 * Karşılaştırma tekillik anahtarı üzerinden yapılır, yani "Admin", "admin" ve
 * "ADMİN" aynı kapıya takılır.
 *
 * KÜFÜR SÜZGECİ BİLEREK YOK. Bir kelime listesi yanlış bir güven duygusu
 * verir: eksiktir, dile bağlıdır ve boşluk/rakam eklenerek kolayca aşılır —
 * yani engellediğini sandığı şeyi engellemez. Dürüst mekanizma bildirimdir:
 * kullanıcılar bildirir, insan karar verir. O akış yazılana kadar bu kapı
 * yalnızca YETKİ TAKLİDİNİ kapatır ve kapsamı budur.
 */
const RESERVED = new Set([
  "admin",
  "administrator",
  "moderator",
  "mod",
  "sistem",
  "system",
  "root",
  "destek",
  "support",
  "yonetici",
  "futbol quiz",
  "futbolquiz",
]);

export type DisplayNameRejection =
  | "bos"
  | "cok-kisa"
  | "cok-uzun"
  | "gecersiz-karakter"
  | "harf-yok"
  | "ayrilmis";

export type DisplayNameResult =
  | { readonly ok: true; readonly value: string; readonly key: string }
  | { readonly ok: false; readonly reason: DisplayNameRejection };

/**
 * Tekillik anahtarı — BR-46'nın "ad tekildir" kuralının ölçütü.
 *
 * NEDEN HAM AD DEĞİL. Ham adla tekillik, "Mehmet" varken "mehmet",
 * "MEHMET" ve "Mehmet" (çift boşluklu) adlarının hepsine izin verirdi;
 * tabloda dört ayrı satır, gözle ayırt edilemez.
 *
 * `toSearchKey` YENİDEN KULLANILIYOR ve bu bir tercih değil, tutarlılık
 * gereği: aynı normalleştirme kulüp aramasında da çalışıyor ve Türkçe'nin iki
 * tuzağını (ı/İ) zaten çözülmüş hâlde taşıyor. İkinci bir normalleştirme
 * yazmak, ikisinin ayrışması demektir.
 */
export function displayNameKey(value: string): string {
  return toSearchKey(value);
}

/**
 * Baştaki/sondaki boşluklar atılır, iç boşluklar teke indirilir, ad NFC'ye
 * normalleştirilir.
 *
 * NFC ZORUNLU ve bunu bir test bulmuştur. "é" iki biçimde yazılabilir: tek
 * kod noktası (U+00E9) ya da `e` + birleşik aksan (U+0065 U+0301). İkisi
 * ekranda aynıdır ama hangisinin geldiği kullanıcının klavyesine ve
 * işletim sistemine bağlıdır. Beyaz liste birleşik işaretleri kapsamaz, yani
 * normalleştirme olmadan ayrışık yazan kullanıcı — kendi göremediği bir
 * sebeple — reddedilirdi.
 *
 * NFC ayrıca uzunluk ölçümünü de kararlı kılar: aynı ad, girdi biçimine göre
 * farklı sayıda karakter saymaz.
 *
 * Her dizi birleşebilmez; birleşemeyen kalırsa beyaz listeye takılır ve bu
 * kabul edilmiştir — liste bilerek dardır.
 */
function tidy(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/gu, " ");
}

/**
 * Görünen adı doğrular — BR-46.
 *
 * SIRA ÖNEMLİ: önce biçim, sonra ayrılmış ad. Böylece kullanıcı "Admin!!!"
 * yazdığında "geçersiz karakter" duyar, "bu ad ayrılmış" değil — ikincisi
 * hangi adların ayrıldığını sızdırırdı.
 */
export function validateDisplayName(raw: string): DisplayNameResult {
  const value = tidy(raw);

  if (value.length === 0) return { ok: false, reason: "bos" };

  // Uzunluk KOD NOKTASIYLA değil, kullanıcının gördüğü karakterle ölçülür;
  // aksi hâlde birleşik işaretler adı olduğundan uzun gösterirdi.
  const length = [...value].length;
  if (length < DISPLAY_NAME_MIN_LENGTH)
    return { ok: false, reason: "cok-kisa" };
  if (length > DISPLAY_NAME_MAX_LENGTH)
    return { ok: false, reason: "cok-uzun" };

  if (!ALLOWED.test(value)) return { ok: false, reason: "gecersiz-karakter" };
  if (!HAS_LETTER.test(value)) return { ok: false, reason: "harf-yok" };

  const key = displayNameKey(value);
  if (key.length === 0) return { ok: false, reason: "harf-yok" };
  if (RESERVED.has(key)) return { ok: false, reason: "ayrilmis" };

  return { ok: true, value, key };
}

/**
 * Reddin kullanıcıya gösterilecek gerekçesi.
 *
 * Metin BURADA duruyor çünkü gerekçe kuralın kendisiyle birlikte değişir;
 * arayüzde ayrı tutulsaydı kural değişince metin sessizce yanlış kalırdı.
 */
export function displayNameRejectionMessage(
  reason: DisplayNameRejection,
): string {
  switch (reason) {
    case "bos":
      return "Bir ad yaz.";
    case "cok-kisa":
      return `Ad en az ${DISPLAY_NAME_MIN_LENGTH} karakter olmalı.`;
    case "cok-uzun":
      return `Ad en fazla ${DISPLAY_NAME_MAX_LENGTH} karakter olabilir.`;
    case "gecersiz-karakter":
      return "Adda yalnızca harf, rakam, boşluk, `-` ve `_` kullanılabilir.";
    case "harf-yok":
      return "Ad en az bir harf içermeli.";
    case "ayrilmis":
      return "Bu ad kullanılamaz. Başka bir ad seç.";
  }
}
