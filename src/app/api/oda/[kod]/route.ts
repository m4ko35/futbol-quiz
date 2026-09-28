import type { NextRequest } from "next/server";
import { getGridRoom } from "@/application/use-cases/grid-rooms";
import { getRoom } from "@/application/use-cases/rooms";
import { getWhichMoreRoom } from "@/application/use-cases/which-more-rooms";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";
import { parseRoomCode, roomRequestContext } from "@/lib/http/room-request";

/**
 * `GET /api/oda/{kod}` — odanın durumu (§12.4).
 *
 * YOKLAMANIN HEDEFİ BURASI (§12.1). İstatistik modu sıra tabanlı olmadığı
 * için iki oyuncunun canlı paylaştığı tek bilgi "rakibim bitirdi mi"; bir
 * soruluk bu bilgi için WebSocket ya da üçüncü taraf bir gerçek zaman servisi
 * kurulmadı ve §7.4'ün sabit adres listesi iki adres olarak kaldı.
 *
 * KOD ADRESTE VE BUNUN BEDELİ BİLİNİYOR. Oda kodu paylaşılan bir sırdır;
 * adreste durduğu için erişim günlüklerine düşer. Riski sınırlayan üç şey
 * var: oda en fazla bir saat yaşıyor (BR-60), okumak ÜYELİK istiyor (aşağıda
 * `getRoom` reddediyor), ve katılmak ayrı bir POST. Yine de bir sır olduğu
 * için kayda geçiyor — günlüğü okuyabilen biri, oda dolmadan katılabilir.
 *
 * ÖNBELLEK YOK: yanıt kimliğe göre değişiyor (rakibin puanı BR-63 gereği
 * yalnızca bitince açılıyor). Paylaşılan bir önbelleğe girseydi bir
 * kullanıcının gördüğü hâl diğerine servis edilirdi (§7.9, BR-47).
 */
export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly kod: string }> },
): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/oda/[kod]",
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

      // MODA GÖRE DAĞITIM (§12.8/§12.9): önce ucuz mod okuması, sonra doğru
      // use-case. Kod yoksa `null` → İstatistik use-case "böyle bir oda yok" der.
      const mode = await deps.rooms.findRoomMode(code);
      if (mode === "hangisi-daha") {
        return getWhichMoreRoom({ now, userId, code }, whichMoreDeps);
      }
      if (mode === "izgara") {
        return getGridRoom({ now, userId, code }, gridDeps);
      }

      return getRoom({ now, userId, code }, deps);
    },
  });
}
