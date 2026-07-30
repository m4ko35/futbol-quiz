/**
 * İstek hızı sınırlama — PORT (PROJECT.md §7.5).
 *
 * Port olmasının somut sebebi var: MVP'de sınırlayıcı bellek içidir ve tek
 * sunucu örneği varsayar. Yatay ölçeklemeye geçildiğinde paylaşımlı bir
 * sayaca (Redis vb.) taşınması gerekecek. Arayüz sayesinde bu, tek dosyalık
 * bir değişikliktir; çağıran hiçbir kod değişmez.
 */

export interface RateLimitDecision {
  readonly allowed: boolean;
  /** `Retry-After` başlığına yazılacak saniye. İzin verildiğinde `0`. */
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  /**
   * Bir anahtar (genellikle istemci IP'si) için jeton tüketmeye çalışır.
   *
   * Eşzamansız DEĞİL: bellek içi uygulama senkrondur ve `await` maliyeti
   * gereksizdir. Paylaşımlı bir sayaca geçildiğinde imza `Promise` dönecek
   * şekilde genişletilir — o değişiklik çağıranları da etkileyeceği için
   * bilinçli olarak şimdi yapılmıyor (YAGNI).
   */
  check(key: string): RateLimitDecision;
}
