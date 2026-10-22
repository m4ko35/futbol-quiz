import type { NextRequest } from "next/server";
import { gameModes } from "@/application/game-modes";
import { GRID_MODE_ID } from "@/application/game-modes/grid";
import { GRID_SIZE } from "@/domain/services/grid";
import { repositories } from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";

/**
 * `GET /api/grid/random` — kullanıcının seçtiği boyutta rastgele, oynanabilir
 * bir ızgara üretir (PROJECT.md §9.1, BR-77).
 *
 * NEDEN GET. Oyun ilerleyişi yok; "Sen kur"daki arama ucuyla (criteria) aynı
 * sınıf — dönen ızgara kullanıcıya zaten gösterilecek olandır. Cevap uçlarının
 * (POST) gerekçesi burada geçerli değil.
 *
 * NEDEN ÖNBELLEKLENMEZ. Her çağrı FARKLI bir ızgara döndürür (tohum rastgele);
 * paylaşılan önbelleğe girerse herkes aynı "rastgele" ızgarayı görürdü. Bu
 * yüzden `cacheable: false` — §7.9'un "aynı URL herkese aynı cevap" niteliği
 * burada bilerek kırılır.
 *
 * BİÇİM: `?size=<2..5>`. Eksikse günlük ızgaranın boyutu (3) kullanılır;
 * geçersiz bir boyut şemada (`isGridSize`) sınırda reddedilir (§2.3).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/grid/random",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    // Her yanıt farklı; paylaşılan önbelleğe girmemeli.
    cacheable: false,
    run: () => {
      const raw = request.nextUrl.searchParams.get("size");
      // Ayrıştırma burada; DOĞRULAMA modun şemasında (isGridSize). Boş/eksik
      // boyut günlük ızgaranın boyutuna düşer.
      const size = raw === null ? GRID_SIZE : Number(raw);

      const mode = gameModes.get(GRID_MODE_ID);
      if (mode === undefined) {
        throw new Error(`Oyun modu kayıtlı değil: ${GRID_MODE_ID} (§9).`);
      }

      return mode.run({ action: "random", size }, repositories);
    },
  });
}
