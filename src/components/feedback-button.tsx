import type { CSSProperties } from "react";

/**
 * Yüzen geri bildirim düğmesinin ORTAK görünümü — hem `mailto` yedeği (sunucu
 * `<a>`) hem form tetikleyicisi (istemci `<button>`) aynı hapı çizsin diye.
 *
 * Bu dosyada "use client" YOK: kanca kullanmıyor, dolayısıyla sunucu ve istemci
 * bileşenlerinin ikisi de import edebilir. Görünüm tek yerde durur; ikisine
 * ayrı ayrı kopyalansaydı biri değişince sessizce ayrışırlardı.
 */

/**
 * Güvenli alan (iOS çentik/ana çubuğu): köşe boşluğu en az 1,25rem, cihaz daha
 * fazlasını isterse ona uyar. Tailwind'de env() yardımcısı yok, o yüzden satır içi.
 */
export const FEEDBACK_BUTTON_STYLE: CSSProperties = {
  bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
  right: "max(1.25rem, env(safe-area-inset-right, 0px))",
};

export const FEEDBACK_BUTTON_CLASS =
  // Yüzen katman: z-40, mevcut açılır listelerin (z-20) üstünde; yerleşik
  // <dialog> (üst katman) her hâlükârda daha yukarıda.
  "fixed z-40 inline-flex items-center justify-center gap-0 sm:gap-2 " +
  // Telefonda daire (56×56), sm'den itibaren etiketli hap.
  "h-14 w-14 rounded-full sm:h-auto sm:w-auto sm:px-5 sm:py-3.5 " +
  // Sitenin birincil eylem dili: accent dolgu + accent tonlu parıltı.
  "bg-accent text-accent-fg text-sm font-semibold " +
  "shadow-lg shadow-accent/30 hover:opacity-95 hover:shadow-accent/40 " +
  "transition-[box-shadow,opacity,transform] duration-150 " +
  "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Düğmenin içi: zarf simgesi + etiket. Etiket telefonda gizli (yalnız simge)
 * ama DOM'da durur; erişilebilir ad hep "Geri bildirim" (WCAG 2.5.3).
 */
export function FeedbackButtonFace() {
  return (
    <>
      {/* Zarf simgesi — depodaki SVG üslubu: currentColor, yuvarlak uçlar (§7.12). */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3.5 7.5 8.5 6 8.5-6" />
      </svg>
      <span className="sr-only whitespace-nowrap sm:not-sr-only">
        Geri bildirim
      </span>
    </>
  );
}
