import type { NextRequest } from "next/server";
import { z } from "zod";
import { createRoom } from "@/application/use-cases/rooms";
import { createWhichMoreRoom } from "@/application/use-cases/which-more-rooms";
import { ValidationError } from "@/domain/errors/domain-error";
import { isStatKey } from "@/domain/services/stat-match";
import { isDirection, isLevel } from "@/domain/services/which-more";
import { isFixedN } from "@/domain/services/which-more-room";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";
import { roomRequestContext } from "@/lib/http/room-request";

/**
 * `POST /api/oda` — oda kurar (§12.4, §12.8, BR-54/BR-55/BR-56/BR-67).
 *
 * NEDEN POST: kayıt yaratıyor ve yan etkisi var (kullanıcının eski odaları
 * siliniyor). GET olsaydı bir bağlantıya tıklatarak başkasına oda kurdurmak
 * mümkün olurdu.
 *
 * GÖVDE ARTIK MOD TAŞIYABİLİR — BR-67. Boş gövde (ya da `mode:"istatistik"`)
 * geriye dönük İstatistik odası kurar; `mode:"hangisi-daha"` ikinci modu kurar.
 * İstatistik odasında hâlâ HEDEF GÖVDEDEN GELMEZ (BR-56): gövde yalnızca hangi
 * oyunun kurulacağını söyler, İstatistik tarafında ek alan yok. Hangisi Daha
 * config'i sınırda **Zod ayrık birliğiyle** doğrulanır (§2.3); tohum sunucuda
 * üretilir, istemci gönderemez (BR-68).
 */

/** Ortak alanlar — istatistik/seviye/yön (config'in tohumsuz, kullanıcı kısmı). */
const statKeySchema = z
  .string()
  .refine(isStatKey, { message: "Bilinmeyen istatistik." });
const levelSchema = z
  .string()
  .refine(isLevel, { message: "Bilinmeyen seviye." });
const directionSchema = z
  .string()
  .refine(isDirection, { message: "Bilinmeyen yön." });

const createBodySchema = z.union([
  z.object({ mode: z.literal("istatistik") }),
  z.object({
    mode: z.literal("hangisi-daha"),
    submode: z.literal("ani-olum"),
    statKey: statKeySchema,
    level: levelSchema,
    direction: directionSchema,
  }),
  z.object({
    mode: z.literal("hangisi-daha"),
    submode: z.literal("sabit-n"),
    statKey: statKeySchema,
    level: levelSchema,
    direction: directionSchema,
    n: z.number().refine(isFixedN, { message: "Tur sayısı 5, 10 veya 15." }),
  }),
]);

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
      const { userId, deps, whichMoreDeps } = await roomRequestContext(request);
      const now = new Date();

      // BOŞ GÖVDE = İstatistik (geriye dönük). Yalnızca gövde varsa ayrıştır.
      const raw = await request.text();
      if (raw.trim() === "") return createRoom({ now, userId }, deps);

      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      }

      const parsed = createBodySchema.safeParse(body);
      // Zod'un ayrıntılı hatası yanıta girmez (§6.3).
      if (!parsed.success) {
        throw new ValidationError("Oda ayarları geçersiz.");
      }

      if (parsed.data.mode === "istatistik") {
        return createRoom({ now, userId }, deps);
      }

      return createWhichMoreRoom(
        {
          now,
          userId,
          submode: parsed.data.submode,
          statKey: parsed.data.statKey,
          level: parsed.data.level,
          direction: parsed.data.direction,
          n: parsed.data.submode === "sabit-n" ? parsed.data.n : undefined,
        },
        whichMoreDeps,
      );
    },
  });
}
