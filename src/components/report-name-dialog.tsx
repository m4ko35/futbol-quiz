"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  type ReportReason,
} from "@/domain/value-objects/report-reason";

/**
 * Görünen ad bildirimi — PROJECT.md §11.12, BR-53.
 *
 * NEDEN `<dialog>`. İlk tasarım, satırın içinde açılan küçük bir paneldi;
 * tablo `overflow-x: auto` bir kapta duruyor ve mutlak konumlanan bir panel
 * orada KIRPILIRDI. Yerleşik `<dialog>` hem bu sorunu hem odak tuzağını,
 * Esc ile kapanmayı ve arka planı devre dışı bırakmayı kendi çözüyor —
 * üçünü elle yazmak, üç ayrı erişilebilirlik kusuru fırsatı demekti.
 *
 * SERBEST METİN ALANI YOK ve bu bir sadeleştirme değil, kuralın kendisi:
 * serbest metin, adına küfredemeyen kişiye bildirim formunda küfretme imkânı
 * verirdi (§11.12).
 */

type Durum = "hazir" | "gonderiliyor" | "alindi" | "hata";

export interface ReportNameDialogProps {
  /** Bildirilecek görünen ad — sunucuya da bu gidiyor, kimlik değil. */
  readonly displayName: string;
}

export function ReportNameDialog({ displayName }: ReportNameDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [durum, setDurum] = useState<Durum>("hazir");
  const groupId = useId();

  const kapat = useCallback(() => {
    dialogRef.current?.close();
    // Bir sonraki açılışta temiz başlasın; "alındı" mesajı asılı kalmasın.
    setDurum("hazir");
  }, []);

  const gonder = useCallback(async () => {
    setDurum("gonderiliyor");

    try {
      const response = await fetch("/api/lider-tablosu/bildir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedName: displayName, reason }),
      });

      if (!response.ok) throw new Error("istek başarısız");
      setDurum("alindi");
    } catch {
      setDurum("hata");
    }
  }, [displayName, reason]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        title="Bu adı bildir"
        className="ms-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md align-middle text-muted transition-colors hover:text-wrong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {/*
          SİMGE SVG, GLİF DEĞİL — ve bu bir üslup tercihi değil, ölçülmüş bir
          kusurun onarımı. Eskiden `⚑` (U+2691) yazıyordu; o karakter gövde
          fontunda YOK, dolayısıyla her platformda başka bir yedek fontla
          çiziliyordu. Depodaki tek glif-simge buydu, geri kalan her yer zaten
          SVG kullanıyor (`brand-mark`, `theme-toggle`).

          KUTU 44×44. Öncekinde `px-1.5 py-0.5 text-xs` vardı: yaklaşık 28×20
          piksel, yani parmakla ıskalanan bir hedef. Görsel ağırlık değişmiyor
          — büyüyen şey yalnızca tıklanabilir alan.
        */}
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
          className="h-4 w-4"
          stroke="currentColor"
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 14.5V2" />
          <path d="M4 3.2h7.6l-1.8 2.6 1.8 2.6H4" />
        </svg>
        <span className="sr-only">{displayName} adını bildir</span>
      </button>

      <dialog
        ref={dialogRef}
        // Tarayıcı varsayılanı ortalamıyor ve arka planı boyamıyor.
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-foreground shadow-card backdrop:bg-black/50"
        onClose={() => setDurum("hazir")}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-bold tracking-tight">Adı bildir</h2>
            <p className="text-sm text-muted">
              <strong className="font-semibold text-foreground">
                {displayName}
              </strong>{" "}
              adını neden bildiriyorsun?
            </p>
          </div>

          {durum === "alindi" ? (
            <>
              <p role="status" className="text-sm">
                Bildirimin alındı. İncelenecek — bir ad{" "}
                <strong>otomatik olarak</strong> kaldırılmaz.
              </p>
              <button
                type="button"
                onClick={kapat}
                className="self-start rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Kapat
              </button>
            </>
          ) : (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Bildirim sebebi</legend>
                {REPORT_REASONS.map((secenek) => (
                  <label
                    key={secenek}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-3 text-sm has-checked:border-accent has-checked:bg-accent-soft"
                  >
                    <input
                      type="radio"
                      name={groupId}
                      value={secenek}
                      checked={reason === secenek}
                      onChange={() => setReason(secenek)}
                      className="accent-accent"
                    />
                    {REPORT_REASON_LABELS[secenek]}
                  </label>
                ))}
              </fieldset>

              {durum === "hata" && (
                <p role="alert" className="text-sm text-wrong">
                  Bildirim gönderilemedi. Lütfen tekrar deneyin.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={durum === "gonderiliyor"}
                  onClick={() => void gonder()}
                  className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                >
                  {durum === "gonderiliyor" ? "Gönderiliyor…" : "Bildir"}
                </button>
                <button
                  type="button"
                  onClick={kapat}
                  className="rounded-lg px-4 py-3 text-sm font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Vazgeç
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
