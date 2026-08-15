import type { NextRequest } from "next/server";
import { gameModes } from "@/application/game-modes";
import { STAT_MATCH_MODE_ID } from "@/application/game-modes/stat-match";
import { repositories } from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { nextRollover } from "@/domain/value-objects/daily-seed";
import { handleApiRequest } from "@/lib/http/api-handler";

/**
 * `GET /api/stat-match` — günün oyuncusu ve istatistikleri (§6.5, §9.2).
 *
 * SORGU PARAMETRESİ YOK (BR-19): gün sunucudan okunur.
 *
 * Izgaradan farklı olarak **hedef değerler açıkça verilir** — oyun onları
 * bilmeyi değil, onlara yakın başka oyuncuları bilmeyi sorar. Gizlenen tek
 * şey aday havuzudur.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/stat-match",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    // Günün oyuncusu gün sınırında değişir (BR-49); önbellek ömrü o sınırı
    // aşamaz — ayrıntılı gerekçe `freshUntil` alanının başında.
    freshUntil: nextRollover(new Date()),
    run: () => {
      const mode = gameModes.get(STAT_MATCH_MODE_ID);
      if (mode === undefined) {
        throw new Error(`Oyun modu kayıtlı değil: ${STAT_MATCH_MODE_ID} (§9).`);
      }

      return mode.run({ action: "daily" }, repositories);
    },
  });
}
