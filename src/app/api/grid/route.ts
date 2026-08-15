import type { NextRequest } from "next/server";
import { gameModes } from "@/application/game-modes";
import { GRID_MODE_ID } from "@/application/game-modes/grid";
import { repositories } from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { nextRollover } from "@/domain/value-objects/daily-seed";
import { handleApiRequest } from "@/lib/http/api-handler";

/**
 * `GET /api/grid` — günün 3×3 ızgarası (PROJECT.md §6.4, §9.1).
 *
 * SORGU PARAMETRESİ YOK ve bu bilinçli. Izgara tarihten türetilir (BR-11) ve
 * tarihi SUNUCU okur; istemcinin gün seçebilmesi, yarının ızgarasını bugünden
 * çekmek ya da geçmiş bir günü tekrar oynamak demekti.
 *
 * Yanıt yalnızca kriterleri taşır — cevapları da, hücre başına cevap sayısını
 * da değil (§9.1 sızıntı kuralı).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/grid",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    // Günlük ızgara gün sınırında değişir (BR-49); önbellek ömrü o sınırı
    // aşamaz — ayrıntılı gerekçe `freshUntil` alanının başında.
    freshUntil: nextRollover(new Date()),
    run: () => {
      const mode = gameModes.get(GRID_MODE_ID);
      if (mode === undefined) {
        // Kayıt defteri bozulmuş demektir; kullanıcıya değil log'a yansır.
        throw new Error(`Oyun modu kayıtlı değil: ${GRID_MODE_ID} (§9).`);
      }

      return mode.run({ action: "daily" }, repositories);
    },
  });
}
