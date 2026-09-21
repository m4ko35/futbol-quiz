/**
 * Izgara simgeleri — TEK KAYNAK (§7.12).
 *
 * Günün ızgarası, "Sen kur" kurucusu ve ölçüt seçicisi aynı simgeleri kullanır.
 * Üç yerde üç kopya olsaydı biri değişip ötekiler geride kalırdı; buraya
 * çıkarıldı ki ızgaranın görsel dili tek yerden gelsin.
 *
 * Hepsi SATIR İÇİ SVG: Material Symbols gibi harici font CSP `font-src 'self'`
 * ile engellenir (§7.3). Süsleme oldukları için `aria-hidden` — taşıdıkları
 * bilgi her zaman yanlarındaki metinde de yazılı.
 */

/**
 * Ölçüt türü rozeti — kulüp için kalkan, uyruk için flama.
 *
 * GENEL bir simge: belirli bir arma/bayrak İDDİA ETMEZ (elimizde yalnızca tür
 * var, `kind`). Türün kendisi her zaman "kulüp"/"uyruk" metninde de duruyor.
 */
export function CriterionIcon({
  kind,
  className = "h-4 w-4 text-muted",
}: {
  readonly kind: "club" | "nationality";
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "club" ? (
        <path d="M12 3 5 6v5c0 4 3 6.9 7 8 4-1.1 7-4 7-8V6l-7-3Z" />
      ) : (
        <>
          <path d="M6 21V4" />
          <path d="M6 4h11l-2.4 3.4L17 11H6" />
        </>
      )}
    </svg>
  );
}

/** Izgara kimliği ikonu — 2×2 kare (matris). */
export function MatrixIcon({
  className = "h-4 w-4 text-muted",
}: {
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
