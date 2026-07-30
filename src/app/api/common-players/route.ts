import type { NextRequest } from "next/server";
import { z } from "zod";
import { gameModes } from "@/application/game-modes";
import { COMMON_PLAYERS_MODE_ID } from "@/application/game-modes/common-players";
import { ValidationError } from "@/domain/errors/domain-error";
import { repositories } from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";

/**
 * `GET /api/common-players` — MVP'nin çekirdek ucu (PROJECT.md §6.2).
 *
 * NEDEN use-case doğrudan değil de oyun modu üzerinden çağrılıyor: §9'daki
 * sözleşmenin gerçekten çalıştığını burada kanıtlıyoruz. Uç, "hangi mod"
 * dışında hiçbir moda özgü bilgi taşımaz; ikinci mod eklendiğinde bu dosya
 * değişmeden kalabilir.
 *
 * İKİ AŞAMALI DOĞRULAMA ve gerekçesi: aşağıdaki şema yalnızca HTTP çözümlemesi
 * yapar — `URLSearchParams` her şeyi dize verir, "true" dizesini `true`
 * boolean'ına çevirmek taşıma katmanının işidir. Alanların ANLAMLI olup
 * olmadığına (kimlik biçimi, varsayılanlar) modun kendi şeması karar verir.
 * İki aşama aynı şeyi iki kez denetlemez; farklı sorular sorarlar.
 */
const querySchema = z.object({
  clubA: z.string(),
  clubB: z.string(),
  // Kasıtlı olarak katı: "1", "yes", "" gibi değerler sessizce `false`
  // sayılmaz, reddedilir. Sessiz yorumlama, kullanıcının açtığını sandığı bir
  // seçeneğin kapalı kalmasına yol açar.
  includeYouth: z.enum(["true", "false"]).optional(),
  includeLoans: z.enum(["true", "false"]).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/common-players",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    run: async () => {
      const raw = Object.fromEntries(request.nextUrl.searchParams);
      const parsed = querySchema.safeParse(raw);

      if (!parsed.success) {
        throw new ValidationError(
          '"clubA" ve "clubB" zorunludur; "includeYouth" ve "includeLoans" ' +
            'yalnızca "true" veya "false" olabilir.',
        );
      }

      const mode = gameModes.get(COMMON_PLAYERS_MODE_ID);
      if (mode === undefined) {
        // Kayıt defteri bozulmuş demektir; kullanıcıya değil log'a yansır.
        throw new Error(
          `Oyun modu kayıtlı değil: ${COMMON_PLAYERS_MODE_ID} (§9).`,
        );
      }

      return mode.run(
        {
          clubA: parsed.data.clubA,
          clubB: parsed.data.clubB,
          ...(parsed.data.includeYouth === undefined
            ? {}
            : { includeYouth: parsed.data.includeYouth === "true" }),
          ...(parsed.data.includeLoans === undefined
            ? {}
            : { includeLoans: parsed.data.includeLoans === "true" }),
        },
        repositories,
      );
    },
  });
}
