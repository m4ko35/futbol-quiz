import { describe, expect, it, vi } from "vitest";
import type {
  FeedbackEmail,
  FeedbackMailer,
  FeedbackSendResult,
} from "@/application/ports/feedback-mailer";
import { submitFeedback } from "@/application/use-cases/submit-feedback";

/**
 * Geri bildirim gönderme — PROJECT.md §7.4.
 *
 * Buradaki testler AĞI değil KARARI ölçüyor: postacı ne dönerse use-case
 * çağırana ne söylüyor ve alanları doğru mu iletiyor. Gerçek Resend çağrısı
 * `tests/unit/infrastructure/feedback-mailer.test.ts` içinde ayrı ölçülüyor.
 */

function mailerOf(result: FeedbackSendResult) {
  const send = vi
    .fn<(email: FeedbackEmail) => Promise<FeedbackSendResult>>()
    .mockResolvedValue(result);
  const mailer: FeedbackMailer = { send };
  return { mailer, send };
}

describe("submitFeedback — §7.4", () => {
  it("postacı başarılıysa 'gonderildi' döner ve alanları iletir", async () => {
    const { mailer, send } = mailerOf({ ok: true });

    await expect(
      submitFeedback(
        { email: "sen@ornek.test", message: "Merhaba, güzel bir site." },
        { mailer },
      ),
    ).resolves.toBe("gonderildi");

    // Adres `reply_to`'ya, mesaj gövdeye — kullanıcının yazdıkları buraya gelir.
    expect(send).toHaveBeenCalledWith({
      replyTo: "sen@ornek.test",
      message: "Merhaba, güzel bir site.",
    });
  });

  it("sağlayıcıya ULAŞILAMAZSA 'gonderilemedi' döner", async () => {
    const { mailer } = mailerOf({ ok: false, reason: "ulasilamadi" });

    await expect(
      submitFeedback(
        { email: "a@b.test", message: "on karakterden uzun bir mesaj" },
        { mailer },
      ),
    ).resolves.toBe("gonderilemedi");
  });

  it("sağlayıcı REDDEDERSE 'gonderilemedi' döner", async () => {
    const { mailer } = mailerOf({ ok: false, reason: "reddedildi" });

    await expect(
      submitFeedback(
        { email: "a@b.test", message: "on karakterden uzun bir mesaj" },
        { mailer },
      ),
    ).resolves.toBe("gonderilemedi");
  });
});
