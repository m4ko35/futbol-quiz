import type { NextRequest } from "next/server";
import { joinRoom } from "@/application/use-cases/rooms";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";
import { parseRoomCode, roomRequestContext } from "@/lib/http/room-request";

/**
 * `POST /api/oda/{kod}/katil` — odaya katılır (§12.4, BR-54/BR-57).
 *
 * TURU BAŞLATAN ÇAĞRI BUDUR ve ayrı bir "başlat" ucu YOK: ikinci oyuncunun
 * katılması ile turun başlaması aynı olaydır. Ayrılsalardı arada kalan sürede
 * oda iki kişilik ama hedefsiz olurdu.
 *
 * YANIT HEDEFİ TAŞIR — ama katılanın kurucudan önce görmesi diye bir durum
 * doğmaz: `startedAt` bu istekte yazılıyor ve kurucunun bir sonraki yoklaması
 * aynı anı okuyor. BR-57'nin istediği simetri budur; kurucuya ERKEN vermemek.
 */
export async function POST(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly kod: string }> },
): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/oda/[kod]/katil",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    cacheable: false,
    run: async () => {
      const { kod } = await context.params;
      const { userId, deps } = await roomRequestContext(request);

      return joinRoom(
        { now: new Date(), userId, code: parseRoomCode(kod) },
        deps,
      );
    },
  });
}
