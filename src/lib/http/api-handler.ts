import type { RateLimiter } from "@/application/ports/rate-limiter";
import { describeError, log } from "../logger";
import { generateTraceId } from "../trace-id";
import { rateLimitedError, toApiError, type MappedError } from "./api-error";

/**
 * Tüm API uçlarının ortak sarmalayıcısı.
 *
 * NEDEN TEK YER: §6.3'ün kuralı ("500 gövdesi ayrıntı sızdırmaz") her uçta
 * ayrı ayrı yazılırsa, ilk unutulan `catch` bloğunda çiğnenir. Sarmalayıcı bu
 * kuralı yapısal hâle getirir: bir uç istisna fırlatmakta serbesttir, yanıtı
 * her zaman burası üretir.
 *
 * Sıra da kuralın parçasıdır: hız sınırı, işin BAŞINDA — veritabanına
 * gitmeden — uygulanır. Aksi hâlde sınırı aşan istek yine de sorguyu
 * çalıştırır ve sınırlama korumak istediği kaynağı korumaz.
 */

export interface ApiRequestContext {
  readonly traceId: string;
}

export interface HandleApiOptions<T> {
  /** Log'da görünecek ad: "/api/clubs". */
  readonly route: string;
  readonly headers: Headers;
  readonly limiter: RateLimiter;
  readonly clientKey: string;
  /**
   * Başarılı yanıt önbelleklenebilir mi? Varsayılan `true`.
   *
   * Sadece POST uçları için `false` verilir. CDN'ler POST yanıtını zaten
   * önbelleklemez; ama `public, s-maxage=…` başlığı göndermek "bu yanıt
   * paylaşılabilir" demektir ve söylediği şey doğru değilse bir sonraki
   * okuyucuyu yanıltır. Başlık, davranışın kendisi kadar sözleşmedir.
   */
  readonly cacheable?: boolean;
  run(context: ApiRequestContext): Promise<T>;
}

const BASE_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "application/json; charset=utf-8",
};

/**
 * Başarılı yanıtların önbellek politikası — PROJECT.md §7.9.
 *
 * Faz 3'e kadar burada `no-store` vardı. O tercih, önbelleklenebilirlik
 * hakkında bir şey BİLİNMEDİĞİ durumda doğru olan güvenli varsayımdı. §3.1'deki
 * mimari kararla artık biliniyor: veri yalnızca yeni bir dağıtımla değişir,
 * yani bir dağıtım içinde bu yanıtlar değişmez.
 *
 * Önbelleklemenin güvenli olmasının üç koşulu var ve üçü de sağlanıyor:
 * yanıt yalnızca sorgu parametrelerine bağlı (oturum/çerez/kullanıcı yok),
 * veri zaten herkese açık, ve dağıtımlar arasında sabit.
 *
 * `s-maxage` ÖNCE 300 sn'ydi ve gerekçesi bir VARSAYIMDI: yeni dağıtımın eski
 * yanıtları geçersiz kıldığı umuluyor ama ölçülmemişti. Varsayım yanlış olsa
 * yeni veri eski önbelleğin arkasında kalırdı — sessizce eski veri servis
 * etmek. 13 Ağustos 2026'da üretimde İKİ KEZ ölçüldü: elle `Redeploy` sonrası
 * ve dağıtım kancasıyla tetiklenen dağıtım sonrası, dağıtımdan önce `HIT`
 * dönen aynı adres `MISS` döndü. Varsayım doğrulandı, süre uzatıldı.
 *
 * NEDEN 1 GÜN, DAHA UZUN DEĞİL. Veri yılda iki kez değişiyor (`data-refresh`
 * takvimi: 20 Şubat, 20 Eylül) ve her değişim bir dağıtımla geliyor, yani
 * geçersizleştirme zaten süreyi bitiriyor — `s-maxage` pratikte hiç dolmuyor.
 * Buradaki sayı, o mekanizma bir gün BOZULURSA hasarın tavanıdır. İki gözlem
 * bir garanti değildir; bir gün, bayat veri yayınının en fazla ne kadar
 * sürebileceğini sınırlar.
 *
 * `stale-while-revalidate` süresi bilerek uzun: veri iki güncelleme arasında
 * değişmediği için bayat bir yanıt sunmak zararsız, buna karşılık her
 * kullanıcının tazeleme maliyetini beklemesi gereksiz.
 */
const CACHEABLE = "public, s-maxage=86400, stale-while-revalidate=604800";

/**
 * Hata yanıtları ASLA önbelleklenmez.
 *
 * En kritiği `429`: önbelleklenmiş bir "hız sınırını aştın" yanıtı, sınırı
 * aşmamış başka istemcilere de servis edilir. Yani hız sınırlayıcı, kendisini
 * hiç tetiklememiş kullanıcıları engelleyen bir araca dönüşür.
 */
const NOT_CACHEABLE = "no-store";

export async function handleApiRequest<T>(
  options: HandleApiOptions<T>,
): Promise<Response> {
  const traceId = generateTraceId();
  const startedAt = Date.now();

  const decision = options.limiter.check(options.clientKey);
  if (!decision.allowed) {
    const mapped = rateLimitedError(traceId, decision.retryAfterSeconds);
    log("warn", "hız sınırı aşıldı", {
      traceId,
      route: options.route,
      status: mapped.status,
      retryAfterSeconds: decision.retryAfterSeconds,
    });

    return respond(mapped);
  }

  try {
    const data = await options.run({ traceId });

    log("info", "istek tamamlandı", {
      traceId,
      route: options.route,
      status: 200,
      durationMs: Date.now() - startedAt,
    });

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: {
        ...BASE_HEADERS,
        "Cache-Control":
          options.cacheable === false ? NOT_CACHEABLE : CACHEABLE,
      },
    });
  } catch (error: unknown) {
    const mapped = toApiError(error, traceId);

    // Ayrıntı YALNIZCA log'a. `mapped.internal` yalnızca 500'lerde doludur ve
    // yığın izini taşır; `mapped.body` ise hiçbir zaman taşımaz.
    log(mapped.status >= 500 ? "error" : "warn", "istek başarısız", {
      traceId,
      route: options.route,
      status: mapped.status,
      code: mapped.body.error.code,
      durationMs: Date.now() - startedAt,
      ...(mapped.internal === undefined
        ? {}
        : { detail: describeError(mapped.internal) }),
    });

    return respond(mapped);
  }
}

function respond(mapped: MappedError): Response {
  return new Response(JSON.stringify(mapped.body), {
    status: mapped.status,
    // `mapped.headers` SONRA gelir ki bir hata eşlemesi kendi başlığını
    // (ör. `Retry-After`) ekleyebilsin; ama önbellek politikasını ezmesin diye
    // `Cache-Control` en sonda yeniden yazılır.
    headers: {
      ...BASE_HEADERS,
      ...mapped.headers,
      "Cache-Control": NOT_CACHEABLE,
    },
  });
}
