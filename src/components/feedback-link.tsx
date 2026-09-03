import {
  FEEDBACK_BUTTON_CLASS,
  FEEDBACK_BUTTON_STYLE,
  FeedbackButtonFace,
} from "./feedback-button";
import { FeedbackWidget } from "./feedback-widget";

/**
 * Öneri ve şikayet düğmesi — her sayfada sağ altta yüzer (§7.4).
 *
 * ÜÇ KİP, TEK KARAR YERİ. Bu bileşen sunucu tarafındadır ve hangi biçimin
 * çizileceğine burada karar verilir; ölçütleri düzen (`layout.tsx`) ortamdan
 * okuyup PROP olarak geçer (§2.1: bileşen `@/infrastructure/**` import edemez):
 *
 *   1. `formEnabled` (Resend anahtarı + CONTACT_EMAIL var) → FORM: tıklayınca
 *      modal açılır, sunucu e-posta gönderir. İstenen davranış budur.
 *   2. yalnız `email` var (anahtar yok) → MAILTO yedeği: düğme doğrudan posta
 *      uygulamasını açar. Anahtar sağlanana kadar bir şey çalışsın diye.
 *   3. hiçbiri → HİÇ çizilmez: gönderilecek yer yoksa ölü bir düğme koymak
 *      yerine öğe tümden düşer (§11.11 "çalışmayan kapıyı tanıtma" kuralı).
 *
 * NEDEN DÜZENDE, ALTBİLGİDE DEĞİL. İstek "bütün sayfalarda" olmasıydı; altbilgi
 * veri kümesi tarihine bağlı ve hata/404 ekranlarında yok. Bu düğme yalnız
 * ortam yapılandırmasına bağlı, o yüzden gerçekten HER sayfada durur. `fixed`
 * olduğu için düzenin flex akışını etkilemez.
 */

export interface FeedbackLinkProps {
  /** `serverEnv().CONTACT_EMAIL` — mailto yedeği için; yoksa `undefined`. */
  readonly email: string | undefined;
  /** `feedbackEmailEnabled()` — sunucudan e-posta gönderimi açık mı? */
  readonly formEnabled: boolean;
}

/** Mailto yedeğinin konusu; form kipinde konu sunucuda belirlenir. */
const SUBJECT = "Futbol Quiz — Öneri / Şikayet";

export function FeedbackLink({ email, formEnabled }: FeedbackLinkProps) {
  if (formEnabled) return <FeedbackWidget />;

  if (email === undefined) return null;

  const href = `mailto:${email}?subject=${encodeURIComponent(SUBJECT)}`;

  return (
    <a
      href={href}
      title="Görüş, öneri ve şikayet için bize e-posta gönder"
      style={FEEDBACK_BUTTON_STYLE}
      className={FEEDBACK_BUTTON_CLASS}
    >
      <FeedbackButtonFace />
    </a>
  );
}
