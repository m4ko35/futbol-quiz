/**
 * API hata gövdesinden kullanıcıya gösterilebilir mesajı çıkarır — §6.3.
 *
 * `api-error.ts`'in AYNADAKİ EŞİ: orası gövdeyi yazar, burası okur. İkisinin
 * ayrı dosyalarda durması bilinçli — yazan taraf sunucuda çalışır ve
 * `DomainError`'a bağımlıdır, okuyan taraf istemci paketine girer ve hiçbir
 * şeye bağımlı değildir.
 *
 * ÜÇ KOPYASI VARDI VE ZATEN AYRIŞMIŞLARDI. `common-players-quiz`,
 * `grid-quiz` ve `stat-match-quiz` bu işlevi taşıyordu; oda ekranları
 * dördüncüyü ekleyecekti. Gövdeyi okuyan on beş satır üçünde de birebir
 * aynıydı ama YEDEK MESAJ ayrışmıştı — biri "Sonuçlar alınamadı", ikisi
 * "İstek tamamlanamadı" diyordu. Ayrışmanın hangi yönde olduğu önemli değil;
 * önemli olan kopyaların sessizce ayrıldığını göstermesi.
 *
 * YEDEK MESAJ PARAMETRE, ortak bir sabit değil: o ayrım gerçekti ve
 * korunuyor. Sonuç bekleyen bir ekranda "sonuçlar alınamadı" demek, "istek
 * tamamlanamadı" demekten daha çok şey anlatır.
 *
 * SUNUCUNUN MESAJI OLDUĞU GİBİ GEÇER. Bu mesajlar tasarım gereği
 * gösterilebilir: kural ihlalini anlatırlar, iç yapıyı değil (§6.3). Yedeğe
 * yalnızca gövde okunamadığında düşülür.
 */

const FALLBACK = "İstek tamamlanamadı. Lütfen tekrar deneyin.";

export async function readErrorMessage(
  response: Response,
  fallback = FALLBACK,
): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "object"
    ) {
      const error = (body as { error: { message?: unknown } }).error;
      if (typeof error.message === "string") return error.message;
    }
  } catch {
    // Gövde JSON değilse aşağıdaki yedek mesaja düşülür.
  }

  return fallback;
}

/**
 * Yakalanan bir istisnadan gösterilebilir mesaj.
 *
 * `catch` blokları `unknown` alır ve üç ekranda da aynı üç satır yazılıydı.
 * Boş mesajlı bir `Error` de yedeğe düşer: kullanıcıya boş bir uyarı kutusu
 * göstermek, hiçbir şey göstermemekten kötüdür.
 */
export function toDisplayMessage(error: unknown, fallback = FALLBACK): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : fallback;
}
