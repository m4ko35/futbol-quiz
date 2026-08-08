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
 * `POST /api/hangisi-daha/round` — yeni bir eşleşme (PROJECT.md §9.3, §6.6).
 *
 * NEDEN POST, bir okuma olmasına rağmen. İki sebep:
 *
 *  1. Dışlama listesi (BR-28) koşu boyunca büyür ve en çok 200 kimlik taşır;
 *     URL'e sığmaz.
 *  2. Yanıt ÖNBELLEKLENMEMELİ — aynı istek her seferinde FARKLI bir rakip
 *     vermelidir. GET olsaydı §7.9'un `s-maxage`'ı aynı eşleşmeyi beş dakika
 *     boyunca herkese servis ederdi ve oyun tek bir soruya düşerdi.
 *
 * BR-32: yanıt sayı taşımaz. Değerler yalnızca cevap ucundan döner.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/hangisi-daha/round",
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

      // Eylem SABİTLENİR: istemci gövdeye `action: "answer"` yazıp bu uçtan
      // değer okuyamasın (BR-32).
      return mode.run({ ...asRecord(body), action: "round" }, repositories);
    },
  });
}

/** Gövde nesne değilse yayılım sessizce boş nesne üretir; açıkça daraltılır. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
