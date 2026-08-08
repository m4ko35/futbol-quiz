import type { NextRequest } from "next/server";
import { gameModes } from "@/application/game-modes";
import { WHICH_MORE_MODE_ID } from "@/application/game-modes/which-more";
import { ValidationError } from "@/domain/errors/domain-error";
import { repositories } from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";

/**
 * `POST /api/hangisi-daha/answer` — cevabın doğrulanması (§9.3, BR-32).
 *
 * DEĞERLER YALNIZCA BURADAN ÇIKAR. Tur ucu iki ismi verir, sayıları vermez;
 * kullanıcı seçimini gönderdikten sonra iki değer birden dönerek "ne kadar
 * yanıldım" sorusunu yanıtlar. Değerler baştan gönderilseydi oyun tarayıcı
 * konsolunda çözülürdü (BR-12/BR-20 ile aynı gerekçe).
 */
export async function POST(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/hangisi-daha/answer",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    cacheable: false,
    run: async () => {
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      });

      const mode = gameModes.get(WHICH_MORE_MODE_ID);
      if (mode === undefined) {
        throw new Error(`Oyun modu kayıtlı değil: ${WHICH_MORE_MODE_ID} (§9).`);
      }

      return mode.run({ ...asRecord(body), action: "answer" }, repositories);
    },
  });
}

/** Gövde nesne değilse yayılım sessizce boş nesne üretir; açıkça daraltılır. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
