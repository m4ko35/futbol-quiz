import type { NextRequest } from "next/server";
import { z } from "zod";
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
 * `GET /api/stat-match/target` — "Sen seç" turunun hedefi (§9.2, BR-24).
 *
 * NEDEN GET, cevap ucunun aksine: burada oyun ilerleyişi yok, bir OKUMA var.
 * Dönen değerler kullanıcıya zaten açıkça gösterilecek olanlar (§9.2'nin
 * sızıntı kuralı), dolayısıyla adreste görünmeleri bir şey sızdırmaz ve yanıt
 * paylaşılan önbelleğe girebilir.
 *
 * BR-24 — geçersiz hedef SESSİZCE düzeltilmez. Altı istatistiği dolu olmayan
 * bir oyuncu için 400 döner ve gerekçesi gövdededir; başka bir oyuncuya
 * kaydırmak, kullanıcının aradığı ismi bulduğunu sanmasına yol açardı.
 *
 * İKİ AŞAMALI DOĞRULAMA (`/api/common-players` ile aynı gerekçe): buradaki
 * şema yalnızca "parametre var mı" sorusunu sorar; kimliğin BİÇİMİNE modun
 * kendi şeması, GEÇERLİLİĞİNE ise depo karar verir.
 */
const querySchema = z.object({ playerId: z.string() });

export async function GET(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/stat-match/target",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    run: () => {
      const raw = Object.fromEntries(request.nextUrl.searchParams);
      const parsed = querySchema.safeParse(raw);

      if (!parsed.success) {
        throw new ValidationError('"playerId" zorunludur.');
      }

      const mode = gameModes.get(STAT_MATCH_MODE_ID);
      if (mode === undefined) {
        throw new Error(`Oyun modu kayıtlı değil: ${STAT_MATCH_MODE_ID} (§9).`);
      }

      return mode.run(
        { action: "chosen", targetId: parsed.data.playerId },
        repositories,
      );
    },
  });
}
