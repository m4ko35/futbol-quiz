import type {
  FeedbackEmail,
  FeedbackMailer,
  FeedbackSendResult,
} from "@/application/ports/feedback-mailer";
import {
  feedbackEmailEnv,
  type FeedbackEmailEnv,
} from "@/infrastructure/config/env";
import { describeError, log } from "@/lib/logger";

/**
 * Geri bildirim postacısı — Resend HTTPS API'si (PROJECT.md §7.4).
 *
 * BU, İSTEK YOLUNDAN AĞA ÇIKAN ÜÇÜNCÜ (ve Turso dışında ikinci HTTP) YERDİR.
 * Adres kodda SABİT (`RESEND_ENDPOINT`), kullanıcı girdisinden türetilmiyor ve
 * yönlendirme takip edilmiyor — `google.ts` ile birebir aynı savunma biçimi.
 *
 * ALICI KULLANICI GİRDİSİ DEĞİLDİR: `to` her zaman `CONTACT_EMAIL`'dir
 * (`feedbackEmailEnv`). Kullanıcının yazdığı adres yalnızca `reply_to`
 * başlığına gider ve Zod ile e-posta biçimi doğrulandığından satır sonu
 * taşıyamaz — yani ne açık röle ne başlık enjeksiyonu.
 */

/** Resend'in tek uç noktası. Değişmez, kullanıcıdan türetilmez (§7.4). */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Gelen postanın konusu; kutuda öneri/şikayeti ayırt etmeyi kolaylaştırır. */
const SUBJECT = "Futbol Quiz — Öneri / Şikayet";

/**
 * Zaman aşımı — 10 saniye. `google.ts` ile aynı gerekçe: sınırsız beklemek,
 * sağlayıcı yavaşladığında sunucusuz işlevi bekletir.
 */
const TIMEOUT_MS = 10_000;

const ROUTE = "/api/geri-bildirim";

/**
 * Postanın düz metin gövdesi. Yanıt adresi başlıkta ZATEN var; gövdeye de
 * yazılıyor ki işletmeci postayı okurken kimin yazdığını görsün.
 */
function bodyText(email: FeedbackEmail): string {
  return `Futbol Quiz sitesinden yeni bir geri bildirim.\n\nYanıt adresi: ${email.replyTo}\n\n${email.message}\n`;
}

/**
 * Postayı Resend üzerinden gönderir. Config (anahtar/gönderen/alıcı) DIŞARIDAN
 * verilir; bu işlev ortam okumaz, böylece ağ dışında birim testi edilebilir.
 */
export async function sendViaResend(
  config: FeedbackEmailEnv,
  email: FeedbackEmail,
): Promise<FeedbackSendResult> {
  const body = JSON.stringify({
    from: config.from,
    to: config.to,
    reply_to: email.replyTo,
    subject: SUBJECT,
    text: bodyText(email),
  });

  let response: Response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      // Yönlendirme TAKİP EDİLMEZ (§7.4): uç yönlendirmez; yönlendirirse
      // konuştuğumuz şeyin Resend olmadığı anlamına gelir.
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error: unknown) {
    // Ağ hatası, zaman aşımı ya da beklenmedik yönlendirme. Ayrıntı LOGA gider,
    // yanıta değil (§6.3); çağıran için üçü de aynı sonucu doğurur.
    log("error", "Resend ucuna ulaşılamadı", {
      route: ROUTE,
      detail: describeError(error),
    });
    return { ok: false, reason: "ulasilamadi" };
  }

  if (!response.ok) {
    /**
     * Sağlayıcının hata gövdesi bir SIR DEĞİL ve teşhisin tamamı odur:
     * yanlış API anahtarı, doğrulanmamış gönderen, kota. Kullanıcıya değil,
     * yalnızca loga yazılır (§6.3).
     */
    const detail: unknown = await response.json().catch(() => null);
    const parsed =
      typeof detail === "object" && detail !== null
        ? (detail as Record<string, unknown>)
        : {};

    log("error", "Resend postayı reddetti", {
      route: ROUTE,
      status: response.status,
      resendError: parsed.name,
      resendMessage: parsed.message,
    });
    return { ok: false, reason: "reddedildi" };
  }

  return { ok: true };
}

/**
 * Somut postacı — yapılandırma yoksa `null` (§7.4).
 *
 * `accountsRepository` ile AYNI KALIP: kompozisyon kökü, ortamı burada bir kez
 * okur ve port'a bağlar. Kapalıysa `null` döner; çağıran özelliği gizler.
 */
export function feedbackMailer(): FeedbackMailer | null {
  const config = feedbackEmailEnv();
  if (config === null) return null;

  return {
    send: (email) => sendViaResend(config, email),
  };
}
