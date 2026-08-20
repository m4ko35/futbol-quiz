import type { NextRequest } from "next/server";
import { z } from "zod";
import { submitRoomAnswer } from "@/application/use-cases/rooms";
import { ValidationError } from "@/domain/errors/domain-error";
import { isStatKey } from "@/domain/services/stat-match";
import {
  isValidIdentifier,
  playerId,
} from "@/domain/value-objects/identifiers";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";
import { parseRoomCode, roomRequestContext } from "@/lib/http/room-request";

/**
 * `POST /api/oda/{kod}/cevap` — oda turunda bir istatistiğin cevabı
 * (§12.4, BR-58, BR-17, BR-20).
 *
 * PUANI SUNUCU HESAPLAR. Gövde yalnızca hangi istatistik ve hangi oyuncu
 * olduğunu taşır; hedef değeri istemci gönderemez. HEDEFİN KİMLİĞİNİ DE
 * GÖNDEREMEZ — günlük uçtan (`/api/stat-match/answer`) ayrıldığı yer burası:
 * orada `targetId` gövdede olabiliyor çünkü "Sen seç" turu öyle çalışıyor
 * (BR-24). Odada hedef ODANIN kendisinde yazılı (BR-56) ve gövdeden gelen bir
 * hedef, kolay bir oyuncu seçip tam puan toplamanın kapısı olurdu.
 *
 * BR-58'İN YARIŞINI VERİTABANI DURDURUR. Bu uç önce okuyup sonra yazıyor;
 * eşzamanlı iki istek ikisi de "bu istatistik boş" görebilir. Kısıt
 * (`@@unique([roomPlayerId, statKey])`) kaybedeni durduruyor ve yanıtta
 * kendi hesabımız değil SAKLANAN cevap dönüyor.
 */

const bodySchema = z.object({
  statKey: z.string().refine(isStatKey, { message: "Bilinmeyen istatistik." }),
  playerId: z.string().refine(isValidIdentifier).transform(playerId),
});

export async function POST(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly kod: string }> },
): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/oda/[kod]/cevap",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    cacheable: false,
    run: async () => {
      const { kod } = await context.params;
      const { userId, deps } = await roomRequestContext(request);

      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      });

      const parsed = bodySchema.safeParse(body);
      // Zod'un ayrıntılı hatası yanıta girmez (§6.3).
      if (!parsed.success) {
        throw new ValidationError("Gönderilen cevap geçersiz.");
      }

      return submitRoomAnswer(
        {
          now: new Date(),
          userId,
          code: parseRoomCode(kod),
          statKey: parsed.data.statKey,
          playerId: parsed.data.playerId,
        },
        deps,
      );
    },
  });
}
