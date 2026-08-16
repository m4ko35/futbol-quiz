import type { NextRequest } from "next/server";
import { z } from "zod";
import { submitStatAnswer } from "@/application/use-cases/submit-stat-answer";
import { ValidationError } from "@/domain/errors/domain-error";
import { isStatKey } from "@/domain/services/stat-match";
import {
  isValidIdentifier,
  playerId,
} from "@/domain/value-objects/identifiers";
import {
  accountsRepository,
  repositories,
} from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { currentUserFromRequest } from "@/lib/auth/current-user";
import { handleApiRequest } from "@/lib/http/api-handler";

/**
 * `POST /api/stat-match/answer` — bir istatistik seçiminin puanlanması
 * (§6.5, BR-18, BR-20, BR-43, BR-44).
 *
 * NEDEN POST: seçimler kullanıcının oyun ilerleyişidir; GET olsaydı tarayıcı
 * geçmişine, erişim loglarına ve paylaşılan önbelleğe URL olarak yazılırdı.
 *
 * PUANI SUNUCU HESAPLAR. Gövde yalnızca hangi istatistik ve hangi oyuncu
 * olduğunu taşır; hedef değeri istemci gönderemez.
 *
 * OYUN MODU KAYIT DEFTERİNDEN GEÇMİYOR ve bu bilinçli bir ayrılma. Modların
 * gördüğü bağımlılık yüzeyi (`GameModeDeps`) kasıtlı olarak dardır — bir mod
 * ileride topluluk katkısı olabilir. Oturum sahibinin kimliğini oraya koymak
 * o yüzeyi genişletirdi; üstelik kimlik istemci girdisi değil, sunucudan
 * gelen bir bilgidir ve mod girdisiyle aynı borudan geçmemelidir.
 */

const bodySchema = z.object({
  statKey: z.string().refine(isStatKey, { message: "Bilinmeyen istatistik." }),
  playerId: z.string().refine(isValidIdentifier).transform(playerId),
  /** Yoksa hedef günün oyuncusudur (BR-19); varsa "Sen seç" turu (BR-24). */
  targetId: z.string().refine(isValidIdentifier).transform(playerId).optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/stat-match/answer",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    // Kişiye özel bir oyun eylemi; paylaşılan önbelleğe girmez (§7.9, BR-47).
    cacheable: false,
    run: async () => {
      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      });

      const parsed = bodySchema.safeParse(body);
      if (!parsed.success) {
        // Zod'un ayrıntılı hatası yanıta girmez (§6.3).
        throw new ValidationError("Gönderilen cevap geçersiz.");
      }

      /**
       * KİMLİK SUNUCUDAN OKUNUR. Gövdeden gelseydi istemci başkasının kimliğini
       * gönderip onun turuna yazardı. Giriş yoksa `null` ve oyun anonim
       * sürer — cevap puanlanır, hiçbir yere yazılmaz.
       */
      const user = await currentUserFromRequest(request);

      return submitStatAnswer(
        {
          now: new Date(),
          statKey: parsed.data.statKey,
          playerId: parsed.data.playerId,
          ...(parsed.data.targetId === undefined
            ? {}
            : { targetId: parsed.data.targetId }),
          userId: user?.id ?? null,
        },
        {
          statMatch: repositories.statMatch,
          accounts: accountsRepository(),
        },
      );
    },
  });
}
