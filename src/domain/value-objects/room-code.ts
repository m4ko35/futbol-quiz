import { InvalidIdentifierError } from "../errors/domain-error";

/**
 * Oda kodu — PROJECT.md §12, BR-55.
 *
 * Bu kod EKRANDA DEĞİL KULAKTA yaşıyor: kullanıcı onu telefonda arkadaşına
 * söyleyecek, arkadaşı da elle yazacak. Alfabesi bu yüzden estetik değil,
 * kullanım kararıdır ve üç eleme birden yapıyor.
 *
 * 1. KARIŞAN İŞARETLER ÇIKARILDI. `0`/`O` ve `1`/`I`/`L` hem ekranda hem
 *    kulakta karışır. Biri kalsaydı yanlış yazılan her kod "oda bulunamadı"
 *    olurdu ve kullanıcı hatanın kendisinde mi bizde mi olduğunu bilemezdi.
 *
 * 2. SESLİ HARFLER TAMAMEN ÇIKARILDI. Sebep kelime oluşumudur: altı harflik
 *    rastgele bir dizi, sesli harf içerdiği anda okunabilir bir kelimeye
 *    dönüşebilir ve o kelimenin hakaret olma ihtimali sıfır değildir. Bir
 *    yasak listesi tutmak bu sorunu ancak saydığı kelimeler için çözer; sesliyi
 *    hiç vermemek SINIFIN TAMAMINI kapatıyor. Aynı karar §11.12'de serbest
 *    metin alanının hiç açılmamasıyla aynı biçimde alınmıştı.
 *
 * 3. TÜRK ALFABESİNDE OLMAYAN HARFLER ÇIKARILDI (`Q`, `W`, `X`). Kod Türkçe
 *    konuşan iki kişi arasında sesli söyleniyor; alfabede olmayan bir harfin
 *    adı üzerinde anlaşılmış değil.
 *
 * Geriye **25 işaret** kalıyor: on yedi ünsüz ve sekiz rakam. Altı karakterlik
 * kod 25⁶ = 244.140.625 olasılık demek. Odalar en fazla bir saat yaşadığı için
 * (BR-60) aynı anda açık oda sayısı bu sayının yanında yok denecek kadar az;
 * kod tahmin etmek pratikte imkânsız, çakışma ise nadirdir ve zaten
 * veritabanı kısıtıyla garanti altındadır.
 */

declare const brand: unique symbol;

export type RoomCode = string & { readonly [brand]: "RoomCode" };

/**
 * `I`, `L`, `O`, `Q`, `W`, `X` ve bütün sesliler yok; `0` ve `1` yok.
 *
 * Sıra alfabetiktir ve öyle kalmalı: `roomCodeFromBytes` bu dizinin İNDİSİNİ
 * kullanıyor, yani sırayı değiştirmek üretilen kodları değiştirir.
 */
export const ROOM_CODE_ALPHABET = "23456789BCDFGHJKMNPRSTVYZ";

export const ROOM_CODE_LENGTH = 6;

/**
 * Yanlılığı önleyen üst sınır — `Math.floor(256 / 25) * 25`.
 *
 * NEDEN GEREKLİ: `bayt % 25` doğrudan kullanılsaydı 0–5 arası indisler diğer
 * indislerden **bir kez fazla** çıkardı (256 = 10 × 25 + 6). Fark küçük ama
 * gerçek ve ölçülebilir; rastgeleliğin yanlı olduğu bir kod, tahmin etmeyi
 * kolaylaştırır. Sınırın üstündeki baytlar atılıyor.
 */
const UNBIASED_LIMIT =
  Math.floor(256 / ROOM_CODE_ALPHABET.length) * ROOM_CODE_ALPHABET.length;

const CODE_PATTERN = new RegExp(
  `^[${ROOM_CODE_ALPHABET}]{${String(ROOM_CODE_LENGTH)}}$`,
  "u",
);

/**
 * Kullanıcının yazdığını kodun kendisine indirger.
 *
 * İnsan `bkj-7tz` yazar, ` BKJ 7TZ ` yapıştırır. Bunları reddetmek kullanıcıya
 * kendi yazdığı kodu düzelttirmek olurdu; ayıklama burada, TEK yerde yapılıyor
 * ki arayüz ile uç aynı kuralı iki kez yazmasın.
 *
 * KÜÇÜK `i` HARFİ SORUNU: Türkçe yerelde `"i".toUpperCase()` `"İ"` verir ve o
 * harf alfabede yok. Dönüşüm bu yüzden yerelsiz yapılıyor — zaten alfabede
 * `I` de yok, yani sonuç iki durumda da reddedilir; ama reddin gerekçesi
 * yerelin ne olduğuna bağlı OLMAMALI.
 */
export function normalizeRoomCode(raw: string): string {
  return raw.replace(/[\s-]/gu, "").toUpperCase();
}

/** Ayıklanmış bir dizenin geçerli kod olup olmadığını fırlatmadan sorar. */
export function isRoomCode(raw: string): boolean {
  return CODE_PATTERN.test(normalizeRoomCode(raw));
}

export function roomCode(raw: string): RoomCode {
  const normalized = normalizeRoomCode(raw);
  if (!CODE_PATTERN.test(normalized)) {
    throw new InvalidIdentifierError("oda kodu", raw);
  }
  return normalized as RoomCode;
}

/**
 * Rastgele baytlardan kod üretir — SAF fonksiyon.
 *
 * Rastgeleliğin KENDİSİ burada üretilmiyor ve bu §2.1'in kuralı: `crypto` bir
 * çalışma zamanı yeteneğidir, alan katmanı onu tanımaz. Çağıran baytları
 * verir, buradan yalnızca eşleme geçer — böylece üretim testte birebir
 * tekrarlanabilir oluyor.
 *
 * Yanlılık elemesi bazı baytları attığı için `bytes` yetmeyebilir; o durumda
 * `null` döner ve çağıran daha fazla baytla yeniden dener. Sessizce yanlı bir
 * koda düşmektense bir tur daha dönmek yeğdir.
 */
export function roomCodeFromBytes(bytes: Uint8Array): RoomCode | null {
  let code = "";

  for (const byte of bytes) {
    if (byte >= UNBIASED_LIMIT) continue;
    code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length];
    if (code.length === ROOM_CODE_LENGTH) return code as RoomCode;
  }

  return null;
}
