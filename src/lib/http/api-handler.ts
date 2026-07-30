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
  run(context: ApiRequestContext): Promise<T>;
}

/** Yanıtların ara belleklerde saklanmaması için ortak başlıklar. */
const BASE_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "application/json; charset=utf-8",
  // Yanıt isteğe ve zamana bağlı; paylaşımlı bir önbellekte durması bir
  // kullanıcının sonucunu başkasına göstermek anlamına gelebilir.
  "Cache-Control": "no-store",
};

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
      headers: { ...BASE_HEADERS },
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
    headers: { ...BASE_HEADERS, ...mapped.headers },
  });
}
