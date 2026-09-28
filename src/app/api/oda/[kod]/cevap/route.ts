import type { NextRequest } from "next/server";
import { z } from "zod";
import { submitGridMove } from "@/application/use-cases/grid-rooms";
import { submitRoomAnswer } from "@/application/use-cases/rooms";
import { submitWhichMoreAnswer } from "@/application/use-cases/which-more-rooms";
import { ValidationError } from "@/domain/errors/domain-error";
import { GRID_SIZE } from "@/domain/services/grid";
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

/** İstatistik cevabı — hangi istatistik, hangi oyuncu (BR-58). */
const statBodySchema = z.object({
  statKey: z.string().refine(isStatKey, { message: "Bilinmeyen istatistik." }),
  playerId: z.string().refine(isValidIdentifier).transform(playerId),
});

/** Hangisi Daha cevabı — hangi düello (roundIndex), hangi kart (§12.8, BR-68). */
const whichMoreBodySchema = z.object({
  roundIndex: z.number().int().min(0),
  chosenId: z.string().refine(isValidIdentifier).transform(playerId),
});

/** Izgara hamlesi — hangi hücre (satır/sütun), hangi futbolcu (§12.9, BR-73). */
const gridMoveBodySchema = z.object({
  row: z
    .number()
    .int()
    .min(0)
    .max(GRID_SIZE - 1),
  column: z
    .number()
    .int()
    .min(0)
    .max(GRID_SIZE - 1),
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
      const { userId, deps, whichMoreDeps, gridDeps } =
        await roomRequestContext(request);
      const now = new Date();
      const code = parseRoomCode(kod);

      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      });

      // MODA GÖRE DAĞITIM (§12.8/§12.9): gövde şekli moda göre değişir; sunucu
      // odanın modunu okuyup DOĞRU şemayla ayrıştırır. Kod yoksa İstatistik yolu
      // "böyle bir oda yok" der (tutarlı).
      const mode = await deps.rooms.findRoomMode(code);

      if (mode === "hangisi-daha") {
        const parsed = whichMoreBodySchema.safeParse(body);
        if (!parsed.success) {
          throw new ValidationError("Gönderilen cevap geçersiz.");
        }
        return submitWhichMoreAnswer(
          {
            now,
            userId,
            code,
            roundIndex: parsed.data.roundIndex,
            chosenId: parsed.data.chosenId,
          },
          whichMoreDeps,
        );
      }

      if (mode === "izgara") {
        const parsed = gridMoveBodySchema.safeParse(body);
        if (!parsed.success) {
          throw new ValidationError("Gönderilen hamle geçersiz.");
        }
        return submitGridMove(
          {
            now,
            userId,
            code,
            row: parsed.data.row,
            column: parsed.data.column,
            playerId: parsed.data.playerId,
          },
          gridDeps,
        );
      }

      const parsed = statBodySchema.safeParse(body);
      // Zod'un ayrıntılı hatası yanıta girmez (§6.3).
      if (!parsed.success) {
        throw new ValidationError("Gönderilen cevap geçersiz.");
      }

      return submitRoomAnswer(
        {
          now,
          userId,
          code,
          statKey: parsed.data.statKey,
          playerId: parsed.data.playerId,
        },
        deps,
      );
    },
  });
}
