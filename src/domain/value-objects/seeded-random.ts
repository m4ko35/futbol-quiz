/**
 * Tohumlu rastgelelik — PROJECT.md §12.8, BR-68.
 *
 * NEDEN VAR. Hangisi Daha odasında iki oyuncu BİREBİR AYNI düello dizisini
 * görmeli (BR-68'in "ortak rayı"). "Kazanan kalır"da kalan oyuncu veriyle
 * belirlendiği için, dizinin tamamı `(tohum, tur indeksi)`'ten deterministik
 * üretilebilir — yeter ki rastgelelik tohumdan türesin. Bu dosya o türevi
 * verir: bir sayıdan, tekrarlanabilir bir `() => number` akışı.
 *
 * NEDEN ALAN KATMANINDA. Üretim `Math.random` ya da `crypto` DEĞİL, çünkü
 * ikisi de tohumlanamaz: aynı tohumdan aynı diziyi bir daha üretemezsin, yani
 * sunucu rayı yeniden oynatamaz. Fonksiyon SAFtır (§2.1): dışarıdan bağımlılık
 * almaz, aynı tohum her yerde aynı akışı verir. `RandomSource` port'unun
 * (kriptografik, tohumsuz) tam karşıtı ve bilinçli: oda kodu TAHMİN EDİLEMEZ
 * olmalı, ray ise TEKRARLANABİLİR.
 *
 * NEDEN AYNI AKIŞ ÇAĞIRANDA PAYLAŞILIR. Solo turda rastgelelik iki yerden
 * girer — `getRound`'un yazı turası (BR-30) ve deponun aday seçimi (§9.3'ün
 * `#pick`'i). Rayın deterministik olması için İKİSİ DE tohumdan beslenmeli;
 * sunucu rayı hep 0. turdan başlayıp aynı sırada aynı çekimleri yaptığı için
 * (§9.3'ün durumsuzluğu) akış birebir tekrarlanır.
 */

/**
 * Tohumdan tekrarlanabilir bir `() => number` üretir (mulberry32).
 *
 * Dönen sayı `[0, 1)` aralığında — `Math.random` ile aynı sözleşme, böylece
 * onu bekleyen her yere (`opponentSide`, deponun `#pick`'i) doğrudan geçer.
 * mulberry32 seçildi çünkü tek 32-bit durum taşır, hızlıdır ve dağılımı bu
 * kullanım için (aday seçimi + yazı tura) fazlasıyla düzgün; kriptografik
 * DEĞİLDİR ama olması da GEREKMEZ — ray zaten herkese açık, sır olan tek şey
 * cevaptır (BR-32) ve o veride, rayda değil.
 *
 * Kapanış BİR DURUM taşır: art arda çağrılar akışı ilerletir. Aynı tohumla
 * yeniden kurulan üreteç, aynı sırayı baştan verir — sunucunun rayı yeniden
 * oynatması buna dayanır.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Kriptografik baytları 32-bit bir tohuma indirger.
 *
 * Tohum oda kurulurken `RandomSource`'tan (crypto) çekilen baytlardan üretilir
 * ki TAHMİN EDİLEMESİN — rakip tohumu bilirse rayın tamamını önceden görürdü.
 * Buradaki eşleme SAFtır; rastgeleliğin kendisi çağıranda (baytlarda). Dört
 * bayttan azı gelirse eksikler 0 sayılır: tohum yine geçerli bir sayıdır,
 * yalnızca daha az entropili — çağıran dört bayt vermekle yükümlü.
 */
export function seedFromBytes(bytes: Uint8Array): number {
  return (
    (((bytes[0] ?? 0) << 24) |
      ((bytes[1] ?? 0) << 16) |
      ((bytes[2] ?? 0) << 8) |
      (bytes[3] ?? 0)) >>>
    0
  );
}
