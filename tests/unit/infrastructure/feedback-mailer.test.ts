import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedbackEmailEnv } from "@/infrastructure/config/env";
import { sendViaResend } from "@/infrastructure/email/feedback-mailer";

/**
 * Resend postacısı — PROJECT.md §7.4.
 *
 * ÖLÇÜLEN ASIL ŞEY: alıcı SABİT geliyor mu (config'ten, kullanıcı gövdesinden
 * değil), yönlendirme kapalı mı, başarısızlıklar doğru ayrışıyor mu.
 */

const CONFIG: FeedbackEmailEnv = {
  apiKey: "re_test_key",
  from: "Futbol Quiz <onboarding@resend.dev>",
  to: "sahip@ornek.test",
};

const EMAIL = {
  replyTo: "kullanici@ornek.test",
  message: "Sitede bir oyuncu eksik görünüyor.",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendViaResend — §7.4", () => {
  it("Resend ucuna sabit adres ve savunmalı ayarlarla POST atar", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(jsonResponse({ id: "abc" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendViaResend(CONFIG, EMAIL)).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    // §7.4: yönlendirme takip edilmez.
    expect(init?.redirect).toBe("error");

    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_key");

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    // ALICI KULLANICIDAN DEĞİL, config'ten (CONTACT_EMAIL). Açık röle değil.
    expect(body.to).toBe("sahip@ornek.test");
    expect(body.reply_to).toBe("kullanici@ornek.test");
    expect(body.from).toBe("Futbol Quiz <onboarding@resend.dev>");
    expect(String(body.text)).toContain("Sitede bir oyuncu eksik görünüyor.");
  });

  it("sağlayıcı reddederse 'reddedildi' döner (ayrıntı yanıta değil)", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse({ name: "validation_error", message: "x" }, 422),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendViaResend(CONFIG, EMAIL)).resolves.toEqual({
      ok: false,
      reason: "reddedildi",
    });
  });

  it("ağ hatası/zaman aşımında 'ulasilamadi' döner", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("network down")));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendViaResend(CONFIG, EMAIL)).resolves.toEqual({
      ok: false,
      reason: "ulasilamadi",
    });
  });
});
