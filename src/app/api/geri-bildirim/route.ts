import type { NextRequest } from "next/server";
import { z } from "zod";
import { submitFeedback } from "@/application/use-cases/submit-feedback";
import { ValidationError } from "@/domain/errors/domain-error";
import {
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_MESSAGE_MIN_LENGTH,
} from "@/domain/value-objects/feedback";
import { feedbackMailer } from "@/infrastructure/email/feedback-mailer";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { handleApiRequest } from "@/lib/http/api-handler";

/**
 * `POST /api/geri-bildirim` — öneri/şikayet formu (§7.4).
 *
 * NEDEN POST: bir e-posta gönderiyor (yan etki). GET olsaydı bir bağlantıya
 * tıklatarak istem dışı gönderim yaptırmak mümkün olurdu.
 *
 * ALICI BURADA YOK ve olmaması kuralın kendisi (§7.4): posta her zaman
 * `CONTACT_EMAIL`'e gider (`feedbackMailer` içinde sabit). Gövdeden yalnızca
 * yanıt adresi ve mesaj gelir — kullanıcı NEREYE gönderileceğini seçemez.
 */

const bodySchema = z.object({
  /** Yanıt adresi; `reply_to` başlığına gider. Biçim burada doğrulanır. */
  email: z.email(),
  /** Görüş/öneri/şikayet metni. Sınırlar domain'den (tek kaynak). */
  message: z
    .string()
    .min(FEEDBACK_MESSAGE_MIN_LENGTH)
    .max(FEEDBACK_MESSAGE_MAX_LENGTH),
});

export async function POST(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/geri-bildirim",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    // Bir e-posta gönderir; paylaşılan önbelleğe girmez (§7.9).
    cacheable: false,
    run: async () => {
      const mailer = feedbackMailer();
      // Özellik kapalıysa (posta anahtarı yok) form da çizilmiyor; buraya gelen
      // istemci sözleşmenin dışında. Hesap yolundaki kalıpla aynı: 400 + açık mesaj.
      if (mailer === null) {
        throw new ValidationError("Geri bildirim şu an kullanılamıyor.");
      }

      const raw: unknown = await request.json().catch(() => {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      });

      const parsed = bodySchema.safeParse(raw);
      // Zod'un ayrıntılı hatası yanıta girmez (§6.3).
      if (!parsed.success) throw new ValidationError("Geri bildirim geçersiz.");

      const outcome = await submitFeedback(
        { email: parsed.data.email, message: parsed.data.message },
        { mailer },
      );

      // İLETİLEMEDİ = SUNUCU tarafı başarısızlık (sağlayıcı erişilemez/reddetti).
      // Kullanıcı hatası değil, o yüzden `ValidationError` DEĞİL: sıradan bir
      // hata fırlatılır ve `handleApiRequest` onu 500'e + genel mesaja çevirir;
      // ayrıntı zaten postacının log'unda (§6.3).
      if (outcome === "gonderilemedi") {
        throw new Error("Geri bildirim e-postası gönderilemedi");
      }

      return { sent: true };
    },
  });
}
