"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  displayNameRejectionMessage,
  validateDisplayName,
} from "@/domain/value-objects/display-name";

/**
 * Görünen ad seçme formu — PROJECT.md §11.10, BR-46.
 *
 * DOĞRULAMA İKİ YERDE ve bu bir tekrar değil, iki farklı iş: buradaki
 * doğrulama kullanıcıya ANINDA geri bildirim verir, sunucudaki doğrulama
 * KURALI ZORLAR. İstemcinin dediğine güvenilmez — bu form hiç çalıştırılmadan
 * uca istek atılabilir.
 *
 * İkisi de AYNI domain işlevini çağırıyor, yani ayrışmaları mümkün değil.
 */
export function DisplayNameForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const trimmed = value.trim();
  const local = trimmed.length === 0 ? null : validateDisplayName(value);

  // Boş alanda hata GÖSTERİLMEZ: kullanıcı daha yazmaya başlamadı, hata
  // göstermek onu bir şeyi yanlış yapmış gibi hissettirir.
  const localMessage =
    local !== null && !local.ok
      ? displayNameRejectionMessage(local.reason)
      : null;

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    const checked = validateDisplayName(value);
    if (!checked.ok) {
      setFailure(displayNameRejectionMessage(checked.reason));
      return;
    }

    setSending(true);
    setFailure(null);

    try {
      const response = await fetch("/api/auth/kayit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: checked.value }),
      });

      if (response.ok) {
        // `refresh` de gerekli: sunucu bileşenleri yeni oturumu görmeli,
        // yoksa hedef sayfa hâlâ "giriş yapılmamış" hâlini gösterir.
        router.replace("/istatistik");
        router.refresh();
        return;
      }

      // Sunucunun gerekçesi OLDUĞU GİBİ gösteriliyor: "bu ad kullanılıyor"
      // bilgisini yumuşatmak, kullanıcıyı aynı adı tekrar denemeye iter.
      const body: unknown = await response.json().catch(() => null);
      const message =
        typeof body === "object" &&
        body !== null &&
        typeof (body as { error?: unknown }).error === "string"
          ? (body as { error: string }).error
          : "Hesap açılamadı. Lütfen tekrar deneyin.";

      setFailure(message);
    } catch {
      setFailure("Bağlantı kurulamadı. Lütfen tekrar deneyin.");
    } finally {
      setSending(false);
    }
  }

  const blocked = local !== null && !local.ok;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-card"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="displayName" className="font-semibold">
          Görünen ad
        </label>
        <input
          id="displayName"
          name="displayName"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setFailure(null);
          }}
          // `maxLength` sınırın KENDİSİ değil, bir kolaylık: kullanıcı
          // yazamayacağı bir uzunluğa girmesin. Kural sunucuda.
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby="displayNameHelp"
          aria-invalid={blocked}
          className="rounded-lg border border-line-strong bg-background px-3 py-2.5 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <p id="displayNameHelp" className="text-sm text-muted">
          {DISPLAY_NAME_MIN_LENGTH}–{DISPLAY_NAME_MAX_LENGTH} karakter; harf,
          rakam, boşluk, <code>-</code> ve <code>_</code>. Lider tablosunda
          herkese görünür.
        </p>
      </div>

      {localMessage !== null && (
        <p className="text-sm text-warn">{localMessage}</p>
      )}

      {failure !== null && (
        <p
          role="alert"
          className="rounded-lg border border-line-strong bg-wrong-soft px-3 py-2 text-sm"
        >
          {failure}
        </p>
      )}

      <button
        type="submit"
        disabled={sending || blocked || trimmed.length === 0}
        className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sending ? "Açılıyor…" : "Hesabı aç"}
      </button>
    </form>
  );
}
