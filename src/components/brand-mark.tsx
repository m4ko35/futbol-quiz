/**
 * Marka işareti — iki kesişen çember, yani uygulamanın tek sorusu: `A ∩ B`.
 *
 * `icon.svg` (favicon) ile AYNI geometri, ama rengi sabit değil: burada
 * `currentColor` kullanılıyor ve işaret bulunduğu yerin rengini alıyor.
 * Favicon'da bu mümkün değil — tarayıcı sekmesi sayfanın temasını devralmaz,
 * o yüzden orada renk sabit yazılmak zorunda.
 *
 * SATIR İÇİ SVG, dosya değil: `img` ile yüklenen bir SVG `currentColor`
 * çözemez ve ayrıca bir ağ isteği daha demektir. İşaret üç şekilden ibaret.
 *
 * `aria-hidden`: yanındaki "Futbol Quiz" yazısı zaten okunuyor; işareti ayrıca
 * seslendirmek aynı bilgiyi iki kez söylemek olurdu (WCAG 1.1.1 süsleme).
 */

export interface BrandMarkProps {
  readonly className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        {/* Kimlik sabit: işaret sayfada bir kez, başlıkta görünür. */}
        <clipPath id="brand-mark-lens">
          <circle cx="12" cy="16" r="9" />
        </clipPath>
      </defs>
      <circle
        cx="12"
        cy="16"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <circle
        cx="20"
        cy="16"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      {/* Dolu mercek: kesişim kümesi — ortak oyuncular. */}
      <circle
        cx="20"
        cy="16"
        r="9"
        fill="currentColor"
        clipPath="url(#brand-mark-lens)"
      />
    </svg>
  );
}
