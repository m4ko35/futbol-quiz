import type { NextRequest } from "next/server";
import { z } from "zod";
import { reportDisplayName } from "@/application/use-cases/report-display-name";
import { ValidationError } from "@/domain/errors/domain-error";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
} from "@/domain/value-objects/display-name";
import { REPORT_REASONS } from "@/domain/value-objects/report-reason";
import { accountsRepository } from "@/infrastructure/db/repositories";
import {
  rateLimiter,
  resolveClientKey,
  trustedProxyHops,
} from "@/infrastructure/rate-limit";
import { currentUserFromRequest } from "@/lib/auth/current-user";
import { handleApiRequest } from "@/lib/http/api-handler";
import { log } from "@/lib/logger";

/**
 * `POST /api/lider-tablosu/bildir` — görünen ad bildirimi (§11.12, BR-53).
 *
 * NEDEN POST: kayıt yaratıyor. GET olsaydı bir bağlantıya tıklatarak başkası
 * adına bildirim yaptırmak mümkün olurdu.
 *
 * SEBEP SABİT BİR LİSTEDEN GELİR ve serbest metin alanı YOKTUR (§11.12):
 * serbest metin, bildirimi ikinci bir hakaret kanalına çevirirdi.
 */

const bodySchema = z.object({
  /**
   * HEDEF ADLA VERİLİR, KİMLİKLE DEĞİL (§11.12): iç tanımlayıcılar herkese
   * açık sayfaya basılmaz. Uzunluk sınırı BR-46'nın sınırıyla aynı — daha
   * uzun bir değer zaten hiçbir hesaba denk gelemez, yani onu aramak boşa
   * sorgu olurdu.
   */
  reportedName: z
    .string()
    .min(DISPLAY_NAME_MIN_LENGTH)
    .max(DISPLAY_NAME_MAX_LENGTH),
  /**
   * `z.enum` SEÇİLDİ, `refine` DEĞİL: ikisi de aynı değerleri kabul eder ama
   * yalnızca `enum` tipi `ReportReason`'a daraltır. `refine` ile şema
   * `string` döndürür ve aşağıda ikinci bir tip koruması yazmak gerekirdi —
   * yani aynı kural iki yerde.
   */
  reason: z.enum(REPORT_REASONS),
});

/**
 * Girişsiz istek `400` alır, `401` değil.
 *
 * Doğrusu `401` olurdu ama bunun bedeli §6'nın hata sözleşmesini yeni bir kod
 * ve yeni bir durum için genişletmekti — hem de arayüzün HİÇ kullanmadığı bir
 * yol için: bildirim düğmesi yalnızca giriş yapmış kullanıcıya çiziliyor.
 * Buraya girişsiz gelen bir istemci zaten sözleşmenin dışında davranıyor ve
 * mesaj ne yapması gerektiğini açıkça söylüyor.
 */
const LOGIN_REQUIRED = "Bildirmek için giriş yapmalısın.";

export async function POST(request: NextRequest): Promise<Response> {
  const clientKey = resolveClientKey(request.headers, trustedProxyHops());

  return handleApiRequest({
    route: "/api/lider-tablosu/bildir",
    headers: request.headers,
    limiter: rateLimiter(),
    clientKey,
    // Kişiye özel bir eylem; paylaşılan önbelleğe girmez (§7.9, BR-47).
    cacheable: false,
    run: async () => {
      const accounts = accountsRepository();
      // Hesap özelliği kapalıysa bildirilecek bir tablo da yok (§11).
      if (accounts === null) throw new ValidationError(LOGIN_REQUIRED);

      const body: unknown = await request.json().catch(() => {
        throw new ValidationError("Gövde geçerli JSON olmalıdır.");
      });

      const parsed = bodySchema.safeParse(body);
      // Zod'un ayrıntılı hatası yanıta girmez (§6.3).
      if (!parsed.success) throw new ValidationError("Bildirim geçersiz.");

      // KİMLİK SUNUCUDAN OKUNUR: gövdeden gelseydi istemci başkası adına
      // bildirim yapardı.
      const reporter = await currentUserFromRequest(request);
      if (reporter === null) throw new ValidationError(LOGIN_REQUIRED);

      const outcome = await reportDisplayName(
        {
          reporter,
          reportedName: parsed.data.reportedName,
          reason: parsed.data.reason,
        },
        { accounts },
      );

      if (outcome === "kendini-bildiremez") {
        throw new ValidationError("Kendi adını bildiremezsin.");
      }
      if (outcome === "kullanici-yok") {
        throw new ValidationError("Böyle bir oyuncu bulunamadı.");
      }

      /**
       * İŞLETMECİYE SİNYAL. §11.12 bildirimin "dikkat çekmesi" gerektiğini
       * söylüyor; betiği çalıştırmadan da görülebilsin diye her bildirim bir
       * log satırı bırakıyor. Görünen ad zaten herkese açık, sızan bir şey yok.
       */
      log("warn", "Görünen ad bildirildi", {
        route: "/api/lider-tablosu/bildir",
        reportedName: parsed.data.reportedName,
        reason: parsed.data.reason,
      });

      return { reported: true };
    },
  });
}
