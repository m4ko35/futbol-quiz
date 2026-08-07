import type { NextRequest } from "next/server";
import { gameModes } from "@/application/game-modes";
import { GRID_MODE_ID } from "@/application/game-modes/grid";
import { ValidationError } from "@/domain/errors/domain-error";
import { repositories } from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";

/**
 * `POST /api/grid/custom-answer` — kullanıcının kurduğu ızgarada bir hücrenin
 * doğrulanması (PROJECT.md §9.1, BR-26).
 *
 * NEDEN AYRI BİR UÇ. `/api/grid/answer` günün ızgarasını TOHUMDAN yeniden
 * üretir ve istemcinin ölçütlerine bakmaz (BR-11/BR-12); burada ölçütler
 * gövdeden gelir. İkisini tek uçta birleştirmek, "ölçütlere güvenilir mi"
 * sorusunun cevabını gövdenin şekline bağlardı — o soru bir uç noktanın
 * sözleşmesi olmalı, bir alanın varlığı değil.
 *
 * NEDEN POST, arama ucunun aksine: bu bir cevap denemesidir, yani kullanıcının
 * OYUN İLERLEYİŞİ. GET olsaydı denemeler tarayıcı geçmişine ve sunucu erişim
 * loglarına URL olarak yazılırdı (`/api/grid/answer` ile aynı gerekçe).
 */
export async function POST(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/grid/custom-answer",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    // Kişiye özel bir oyun eylemi; paylaşılan önbelleğe girmez.
    cacheable: false,
    run: async () => {
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      });

      const mode = gameModes.get(GRID_MODE_ID);
      if (mode === undefined) {
        throw new Error(`Oyun modu kayıtlı değil: ${GRID_MODE_ID} (§9).`);
      }

      // Eylem burada SABİTLENİR: istemci gövdeye başka bir `action` yazıp bu
      // uçtan günün ızgarasını çekemesin.
      return mode.run(
        { ...asRecord(body), action: "custom-answer" },
        repositories,
      );
    },
  });
}

/** Gövde nesne değilse yayılım sessizce boş nesne üretir; açıkça daraltılır. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
