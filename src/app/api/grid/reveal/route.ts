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
 * `POST /api/grid/reveal` — günün ızgarasında pes eden kullanıcıya boş
 * hücrelerin örnek cevapları (PROJECT.md §9.1, BR-66).
 *
 * NEDEN POST. Uç CEVAP DÖNDÜRÜR; GET olsaydı cevaplar tarayıcı geçmişine,
 * sunucu erişim loglarına ve paylaşılan önbelleğe URL olarak yazılırdı — aynı
 * ızgarayı henüz oynamamış biri başkasının cevaplarını bir kayıttan okuyabilirdi
 * (`/api/grid/answer` ile aynı gerekçe).
 *
 * CEVAP DÖNDÜRMEK SIZINTI DEĞİL, TASARIMDIR. Sızıntı kuralı ızgaranın teslimini
 * (GET `/api/grid`) bağlar; bu uç kullanıcının pes ettikten sonra AÇIKÇA
 * istediği eylemdir. Bugün güvenli çünkü ızgarada skor/sıralama yok (§10.2).
 *
 * İSTEMCİNİN KRİTERLERİNE GÜVENİLMEZ. Gövde yalnızca hücre koordinatlarını
 * taşır; sunucu ızgarayı YENİDEN ÜRETİP koordinatı kendi ölçütüne çevirir.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/grid/reveal",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    // Cevapları taşıyan kişiye özel bir yanıt; paylaşılan önbelleğe girmez.
    cacheable: false,
    run: async () => {
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      });

      const mode = gameModes.get(GRID_MODE_ID);
      if (mode === undefined) {
        throw new Error(`Oyun modu kayıtlı değil: ${GRID_MODE_ID} (§9).`);
      }

      // Eylem burada SABİTLENİR: istemci gövdeye başka bir `action` yazamasın.
      return mode.run({ ...asRecord(body), action: "reveal" }, repositories);
    },
  });
}

/** Gövde nesne değilse yayılım sessizce boş nesne üretir; açıkça daraltılır. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
