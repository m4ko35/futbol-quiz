import type { NextRequest } from "next/server";
import { gameModes } from "@/application/game-modes";
import { STAT_MATCH_MODE_ID } from "@/application/game-modes/stat-match";
import { ValidationError } from "@/domain/errors/domain-error";
import { repositories } from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";

/**
 * `POST /api/stat-match/answer` — bir istatistik seçiminin puanlanması
 * (§6.5, BR-18, BR-20).
 *
 * NEDEN POST: ızgara cevabıyla aynı gerekçe — seçimler kullanıcının oyun
 * ilerleyişidir ve GET olsaydı tarayıcı geçmişine, erişim loglarına ve
 * paylaşılan önbelleğe URL olarak yazılırdı.
 *
 * PUANI SUNUCU HESAPLAR. Gövde yalnızca hangi istatistik ve hangi oyuncu
 * olduğunu taşır; hedef değeri istemci gönderemez, gönderebilseydi kendi
 * hedefini uydurup %100 alırdı.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/stat-match/answer",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    // Kişiye özel bir oyun eylemi; paylaşılan önbelleğe girmez (§7.9).
    cacheable: false,
    run: async () => {
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      });

      const mode = gameModes.get(STAT_MATCH_MODE_ID);
      if (mode === undefined) {
        throw new Error(`Oyun modu kayıtlı değil: ${STAT_MATCH_MODE_ID} (§9).`);
      }

      // Eylem SUNUCUDA sabitlenir; istemci "daily" gönderip bu uçtan günün
      // oyuncusunu çekemesin.
      return mode.run({ ...asRecord(body), action: "answer" }, repositories);
    },
  });
}

/** Yayılım yalnızca nesnelere uygulanır; dizi/`null` açıkça daraltılır. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
