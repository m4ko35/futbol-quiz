import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  MAX_CLUB_RESULTS,
  MAX_SEARCH_TERM_LENGTH,
  searchClubs,
} from "@/application/use-cases/search-clubs";
import { repositories } from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";
import { ValidationError } from "@/domain/errors/domain-error";

/**
 * `GET /api/clubs` — kulüp arama / otomatik tamamlama (PROJECT.md §6.1).
 */

/**
 * Sorgu parametresi şeması (§2.3, §7.1).
 *
 * `URLSearchParams` her zaman dize verir; sayıya çevirme ve üst sınır
 * uygulama bu katmanın işidir. Uzunluk ve aralık sınırları burada ZORUNLUDUR:
 * kelepçelenmemiş bir `limit`, tek istekle tüm tabloyu okutabilirdi.
 */
const querySchema = z.object({
  q: z.string().max(MAX_SEARCH_TERM_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_CLUB_RESULTS).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/clubs",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    run: async () => {
      const raw = Object.fromEntries(request.nextUrl.searchParams);
      const parsed = querySchema.safeParse(raw);

      if (!parsed.success) {
        // Zod'un ayrıntılı hata ağacı yanıta girmez (§6.3); kullanıcıya
        // düzeltebileceği kadarını söyleyen sabit bir mesaj döner.
        throw new ValidationError(
          `Geçersiz arama parametresi. "q" en fazla ${MAX_SEARCH_TERM_LENGTH} ` +
            `karakter, "limit" 1–${MAX_CLUB_RESULTS} aralığında olmalıdır.`,
        );
      }

      return searchClubs(
        {
          ...(parsed.data.q === undefined ? {} : { term: parsed.data.q }),
          ...(parsed.data.limit === undefined
            ? {}
            : { limit: parsed.data.limit }),
        },
        { clubs: repositories.clubs },
      );
    },
  });
}
