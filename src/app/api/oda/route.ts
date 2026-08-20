import type { NextRequest } from "next/server";
import { createRoom } from "@/application/use-cases/rooms";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";
import { roomRequestContext } from "@/lib/http/room-request";

/**
 * `POST /api/oda` — oda kurar (§12.4, BR-54/BR-55/BR-56).
 *
 * NEDEN POST: kayıt yaratıyor ve yan etkisi var (kullanıcının eski odaları
 * siliniyor). GET olsaydı bir bağlantıya tıklatarak başkasına oda kurdurmak
 * ve açık odasını sildirmek mümkün olurdu.
 *
 * GÖVDE YOK ve bu BR-56'nın kendisi: hedefi sunucu seçiyor, istemcinin
 * söyleyeceği bir şey yok. Bir gövde alsaydık, "kurucu hedefi seçsin"
 * özelliği geldiğinde onu eş zamanlı açılışla birlikte tasarlamak yerine
 * sessizce buraya eklemek cazip olurdu.
 *
 * YANIT HEDEFİ TAŞIMAZ — BR-57. Oda `bekliyor` durumunda kuruluyor ve
 * `present` hedefi ancak `startedAt` yazıldıktan sonra okuyor.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/oda",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    // Kişiye özel bir oyun eylemi; paylaşılan önbelleğe girmez (§7.9, BR-47).
    cacheable: false,
    run: async () => {
      const { userId, deps } = await roomRequestContext(request);

      return createRoom({ now: new Date(), userId }, deps);
    },
  });
}
