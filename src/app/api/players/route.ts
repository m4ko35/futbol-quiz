import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  MAX_PLAYER_RESULTS,
  MAX_PLAYER_TERM_LENGTH,
  searchPlayers,
} from "@/application/use-cases/search-players";
import { ValidationError } from "@/domain/errors/domain-error";
import { repositories } from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";

/**
 * `GET /api/players` — oyuncu arama (PROJECT.md §6.4).
 *
 * Izgarada cevap seçmek için kullanılır. Kullanıcı ad YAZMAZ, listeden SEÇER
 * (BR-12); bu uç o listeyi üretir. Yanıt oyuncunun kulüp geçmişini TAŞIMAZ —
 * taşısaydı arama kutusu oyunun cevap anahtarına dönüşürdü (§9.1).
 *
 * `q` ZORUNLUDUR, kulüp aramasındaki gibi isteğe bağlı değil: 76.358 kayıtlık
 * bir tabloda "hepsini listele" diye bir istek anlamlı olamaz.
 */
const querySchema = z.object({
  q: z.string().max(MAX_PLAYER_TERM_LENGTH),
  limit: z.coerce.number().int().min(1).max(MAX_PLAYER_RESULTS).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/players",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    run: async () => {
      const raw = Object.fromEntries(request.nextUrl.searchParams);
      const parsed = querySchema.safeParse(raw);

      if (!parsed.success) {
        throw new ValidationError(
          `Geçersiz arama parametresi. "q" zorunludur ve en fazla ` +
            `${MAX_PLAYER_TERM_LENGTH} karakter, "limit" 1–${MAX_PLAYER_RESULTS} ` +
            `aralığında olmalıdır.`,
        );
      }

      return searchPlayers(
        {
          term: parsed.data.q,
          ...(parsed.data.limit === undefined
            ? {}
            : { limit: parsed.data.limit }),
        },
        { players: repositories.players },
      );
    },
  });
}
