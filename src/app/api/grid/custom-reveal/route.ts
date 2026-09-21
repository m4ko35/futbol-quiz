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
 * `POST /api/grid/custom-reveal` — kullanıcının kurduğu ızgarada pes edince boş
 * hücrelerin örnek cevapları (PROJECT.md §9.1, BR-66, BR-26).
 *
 * NEDEN AYRI BİR UÇ, `custom-answer` ile aynı gerekçe: burada ölçütler
 * GÖVDEDEN gelir (BR-26), günlük ızgarada tohumdan üretilir. "Ölçütlere
 * güvenilir mi" sorusunun cevabı bir ucun sözleşmesi olmalı, bir alanın varlığı
 * değil.
 *
 * NEDEN POST: uç cevap döndürür (`/api/grid/reveal` ile aynı gerekçe).
 */
export async function POST(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/grid/custom-reveal",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    cacheable: false,
    run: async () => {
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      });

      const mode = gameModes.get(GRID_MODE_ID);
      if (mode === undefined) {
        throw new Error(`Oyun modu kayıtlı değil: ${GRID_MODE_ID} (§9).`);
      }

      return mode.run(
        { ...asRecord(body), action: "custom-reveal" },
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
