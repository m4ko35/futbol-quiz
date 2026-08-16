"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Çıkış ve hesap silme — PROJECT.md §11.10, BR-48.
 *
 * SİLME İKİ ADIMLI. Tek tıkla silmek, geri alınamayan bir işlemi yanlışlıkla
 * tetiklenebilir kılardı. Onay adımı NE SİLİNECEĞİNİ de söylüyor: "hesabın ve
 * bütün skorların" — kullanıcı neyi kaybettiğini bilerek onaylamalı (BR-48
 * "hangisi olduğu silmeden ÖNCE söylenir" diyor).
 */
export function AccountActions() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function post(path: string): Promise<void> {
    setBusy(true);
    setFailure(null);

    try {
      const response = await fetch(path, { method: "POST" });
      if (!response.ok) throw new Error("istek başarısız");

      router.replace("/");
      // Sunucu bileşenleri oturumun gittiğini görmeli; yoksa sayfa hâlâ
      // giriş yapılmış hâlini gösterir.
      router.refresh();
    } catch {
      setFailure("İşlem tamamlanamadı. Lütfen tekrar deneyin.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => void post("/api/auth/cikis")}
        className="self-start rounded-lg border border-line-strong px-4 py-2.5 text-sm font-semibold transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
      >
        Çıkış yap
      </button>

      <div className="flex flex-col gap-3 rounded-xl border border-line-strong bg-wrong-soft p-4">
        <p className="text-sm">
          <strong>Hesabı sil.</strong> Hesabın ve{" "}
          <strong>bütün skorların</strong> kalıcı olarak silinir; lider
          tablosundaki satırların da kaybolur. Bu işlem geri alınamaz.
        </p>

        {confirming ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void post("/api/auth/hesap-sil")}
              className="rounded-lg bg-wrong px-4 py-2 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
            >
              {busy ? "Siliniyor…" : "Evet, hesabımı sil"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Vazgeç
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="self-start rounded-lg border border-wrong px-4 py-2 text-sm font-semibold text-wrong transition-colors hover:bg-wrong-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Hesabımı sil
          </button>
        )}
      </div>

      {failure !== null && (
        <p role="alert" className="text-sm text-wrong">
          {failure}
        </p>
      )}
    </div>
  );
}
