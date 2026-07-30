import type { RateLimiter } from "@/application/ports/rate-limiter";
import { serverEnv } from "../config/env";
import { TokenBucketRateLimiter } from "./token-bucket";

export { resolveClientKey, SHARED_KEY } from "./client-key";
export { TokenBucketRateLimiter } from "./token-bucket";

/**
 * Tekil hız sınırlayıcı.
 *
 * Neden global: sınırlayıcının durumu (kovalar) istekler arasında YAŞAMAK
 * zorundadır. Geliştirmede Next her sıcak yenilemede modülleri yeniden
 * değerlendirir; global saklanmasaydı her düzenlemede sayaçlar sıfırlanır ve
 * sınırın çalıştığı elle doğrulanamazdı (`client.ts` ile aynı gerekçe).
 */
const globalForRateLimit = globalThis as unknown as {
  rateLimiter: RateLimiter | undefined;
};

function createRateLimiter(): RateLimiter {
  const env = serverEnv();
  return new TokenBucketRateLimiter({
    requestsPerMinute: env.RATE_LIMIT_REQUESTS_PER_MINUTE,
    burst: env.RATE_LIMIT_BURST,
  });
}

export function rateLimiter(): RateLimiter {
  globalForRateLimit.rateLimiter ??= createRateLimiter();
  return globalForRateLimit.rateLimiter;
}

/** İstemci anahtarı çözümlenirken kullanılacak güvenilen vekil sayısı. */
export function trustedProxyHops(): number {
  return serverEnv().TRUSTED_PROXY_HOPS;
}
