"use client";

import { type FormEvent, useCallback, useId, useRef, useState } from "react";
import {
  FEEDBACK_BUTTON_CLASS,
  FEEDBACK_BUTTON_STYLE,
  FeedbackButtonFace,
} from "./feedback-button";
import { Button } from "./ui/button";
import {
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_MESSAGE_MIN_LENGTH,
} from "@/domain/value-objects/feedback";

/**
 * Öneri/şikayet formu — sağ altta yüzen düğme, tıklayınca modal (§7.4).
 *
 * NEDEN `<dialog>`. Odak tuzağı, Esc ile kapanma ve arka planı devre dışı
 * bırakma yerleşik gelir; üçünü elle yazmak üç ayrı erişilebilirlik kusuru
 * fırsatıydı — `report-name-dialog` ile aynı gerekçe.
 *
 * NEDEN İSTEMCİ BİLEŞENİ. Form durumu ve `fetch` var. Adres PROP DEĞİL: form
 * hiçbir adres taşımaz, gönderim `/api/geri-bildirim`'e gider ve alıcı
 * (`CONTACT_EMAIL`) yalnızca SUNUCUDA bilinir (§7.4) — sır istemciye inmez.
 *
 * BİÇİM İKİ KEZ DENETLENİR: burada (anında geri bildirim için) ve sunucuda
 * (gerçek kapı). İstemci denetimi bir kolaylıktır, güvenlik sınırı değil.
 */

type Durum = "hazir" | "gonderiliyor" | "alindi" | "hata" | "cok-fazla";

interface AlanHatalari {
  readonly email?: string;
  readonly message?: string;
}

/** Basit e-posta biçimi — sunucu `z.email()` ile kesin denetler; bu yalnız erken uyarı. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function dogrula(email: string, message: string): AlanHatalari {
  const hatalar: { email?: string; message?: string } = {};

  if (email.length === 0) {
    hatalar.email = "E-posta adresini yaz.";
  } else if (!EMAIL_PATTERN.test(email)) {
    hatalar.email = "Geçerli bir e-posta adresi yaz.";
  }

  if (message.length < FEEDBACK_MESSAGE_MIN_LENGTH) {
    hatalar.message = `Mesaj en az ${String(FEEDBACK_MESSAGE_MIN_LENGTH)} karakter olmalı.`;
  } else if (message.length > FEEDBACK_MESSAGE_MAX_LENGTH) {
    hatalar.message = `Mesaj en fazla ${String(FEEDBACK_MESSAGE_MAX_LENGTH)} karakter olabilir.`;
  }

  return hatalar;
}

export function FeedbackWidget() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [durum, setDurum] = useState<Durum>("hazir");
  const [hatalar, setHatalar] = useState<AlanHatalari>({});
  const emailId = useId();
  const messageId = useId();
  const emailErrorId = useId();
  const messageErrorId = useId();

  const kapat = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const sifirla = useCallback(() => {
    // Bir sonraki açılış temiz başlasın; "alındı" mesajı asılı kalmasın.
    setDurum("hazir");
    setHatalar({});
  }, []);

  const gonder = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const temizEmail = email.trim();
      const temizMesaj = message.trim();

      const bulunan = dogrula(temizEmail, temizMesaj);
      setHatalar(bulunan);
      if (bulunan.email !== undefined || bulunan.message !== undefined) return;

      setDurum("gonderiliyor");

      try {
        const response = await fetch("/api/geri-bildirim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: temizEmail, message: temizMesaj }),
        });

        if (response.status === 429) {
          setDurum("cok-fazla");
          return;
        }
        if (!response.ok) throw new Error("istek başarısız");

        setDurum("alindi");
        setEmail("");
        setMessage("");
      } catch {
        setDurum("hata");
      }
    },
    [email, message],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        title="Görüş, öneri ve şikayet için formu aç"
        style={FEEDBACK_BUTTON_STYLE}
        className={FEEDBACK_BUTTON_CLASS}
      >
        <FeedbackButtonFace />
      </button>

      <dialog
        ref={dialogRef}
        // Tarayıcı varsayılanı ortalamıyor ve arka planı boyamıyor.
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-foreground shadow-card backdrop:bg-black/50"
        onClose={sifirla}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-bold tracking-tight">Geri bildirim</h2>
            <p className="text-sm text-muted">
              Siteyle ilgili görüş, öneri ve şikayetini yaz — okuyup
              yanıtlıyoruz.
            </p>
          </div>

          {durum === "alindi" ? (
            <>
              <p role="status" className="text-sm">
                Teşekkürler! Geri bildirimin bize ulaştı.
              </p>
              <Button size="md" className="self-start" onClick={kapat}>
                Kapat
              </Button>
            </>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={gonder} noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={emailId} className="text-sm font-medium">
                  E-posta adresin
                </label>
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="sen@ornek.com"
                  aria-invalid={hatalar.email !== undefined}
                  aria-describedby={
                    hatalar.email !== undefined ? emailErrorId : undefined
                  }
                  className="rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
                />
                {hatalar.email !== undefined && (
                  <p
                    id={emailErrorId}
                    role="alert"
                    className="text-sm text-wrong"
                  >
                    {hatalar.email}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={messageId} className="text-sm font-medium">
                  Mesajın
                </label>
                <textarea
                  id={messageId}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
                  placeholder="Görüş, öneri ya da şikayetin…"
                  aria-invalid={hatalar.message !== undefined}
                  aria-describedby={
                    hatalar.message !== undefined ? messageErrorId : undefined
                  }
                  className="resize-y rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
                />
                {hatalar.message !== undefined && (
                  <p
                    id={messageErrorId}
                    role="alert"
                    className="text-sm text-wrong"
                  >
                    {hatalar.message}
                  </p>
                )}
              </div>

              {durum === "hata" && (
                <p role="alert" className="text-sm text-wrong">
                  Gönderilemedi. Lütfen biraz sonra tekrar dene.
                </p>
              )}
              {durum === "cok-fazla" && (
                <p role="alert" className="text-sm text-wrong">
                  Çok fazla gönderim oldu. Lütfen biraz sonra tekrar dene.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="md"
                  type="submit"
                  loading={durum === "gonderiliyor"}
                >
                  {durum === "gonderiliyor" ? "Gönderiliyor…" : "Gönder"}
                </Button>
                <button
                  type="button"
                  onClick={kapat}
                  className="rounded-lg px-4 py-3 text-sm font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
