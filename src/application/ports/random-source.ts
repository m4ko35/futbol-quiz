/**
 * Kriptografik rastgelelik — PORT (PROJECT.md §4.1, §12).
 *
 * NEDEN PORT. Oda kodu tahmin edilemez olmak zorunda (BR-55), yani `Math.random`
 * kullanılamaz. Ama `crypto.getRandomValues` doğrudan çağrılsaydı kod üretimi
 * TEST EDİLEMEZ olurdu: hangi kodun çıkacağı bilinemediği için ne çakışma
 * yolu ne de yanlılık elemesi sınanabilirdi. Port, rastgeleliği bir bağımlılık
 * hâline getiriyor.
 *
 * DAR TUTULDU. Tek bir metodu var ve bilerek: "rastgele sayı", "rastgele
 * eleman", "karıştır" gibi kolaylıklar eklendiğinde her biri kendi yanlılık
 * sorusunu getirir. Ham bayt tek bir soru sorar ve o soru `roomCodeFromBytes`
 * içinde bir kez cevaplanmıştır.
 */
export interface RandomSource {
  /** İstenen sayıda kriptografik rastgele bayt. */
  bytes(count: number): Uint8Array;
}
