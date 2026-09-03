import type { FeedbackMailer } from "../ports/feedback-mailer";

/**
 * Geri bildirim gönderme — PROJECT.md §7.4.
 *
 * BİÇİM DOĞRULAMASI SINIRDA YAPILIR (route'un Zod şeması); use-case buraya
 * gelen adresin ve mesajın zaten geçerli olduğuna güvenir — `reportDisplayName`
 * ile aynı iş bölümü. Buranın işi ORKESTRASYON: postacıyı çağırıp sonucu
 * çağırana anlamlı bir çıktıya çevirmek.
 *
 * NEDEN AYRI BİR USE-CASE. İnce ama seam burada: route somut postacıyı
 * (Resend) enjekte eder, use-case yalnızca port'u görür. Böylece "gönderildi mi,
 * gönderilemedi mi" kararı ağdan bağımsız test edilir.
 */

export type FeedbackOutcome =
  /** Posta sağlayıcısına iletildi. */
  | "gonderildi"
  /**
   * İletilemedi — SUNUCU tarafı bir başarısızlık (sağlayıcı erişilemez ya da
   * reddetti). Kullanıcının düzeltebileceği bir şey değil; route bunu 500'e
   * çevirir, ayrıntı postacının log'unda kalır (§6.3).
   */
  | "gonderilemedi";

export interface SubmitFeedbackInput {
  readonly email: string;
  readonly message: string;
}

export interface SubmitFeedbackDeps {
  readonly mailer: FeedbackMailer;
}

export async function submitFeedback(
  input: SubmitFeedbackInput,
  deps: SubmitFeedbackDeps,
): Promise<FeedbackOutcome> {
  const result = await deps.mailer.send({
    replyTo: input.email,
    message: input.message,
  });

  return result.ok ? "gonderildi" : "gonderilemedi";
}
