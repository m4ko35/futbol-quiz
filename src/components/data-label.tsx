import type { ElementType, ReactNode } from "react";

/**
 * "Veri etiketi" — editorial tipografinin imzası (§7.12).
 *
 * Barlow Condensed (`font-display`), BÜYÜK HARF ve tracking'li: künye, telemetri
 * ve eyebrow metinleri ("CANLI VERİ TABANI", "ORTAK KAYIT"). Stitch tasarımının
 * `label-data-*` ölçeği bu bileşene indirgeniyor — yirmi yerde `font-display
 * uppercase tracking-[…]` tekrar etmesin, ölçek tek yerden değişsin diye.
 *
 * BÜYÜK HARF CSS İLE (`uppercase`): ekran okuyucuya giden metin ham kalır. Sayfa
 * `lang="tr"` olduğu için tarayıcı Türkçe döküm kuralını uygular (i → İ), yani
 * "İstatistik" → "İSTATİSTİK" doğru çıkar (§7.12 latin-ext ile aynı gerekçe).
 *
 * Renk TAŞIMAZ: rengi çağıran verir (`text-muted`, `text-accent`…), böylece aynı
 * etiket farklı zeminlerde doğru kontrastı alır.
 */

const SIZES = {
  sm: "text-[0.72rem] tracking-[0.08em]",
  md: "text-sm tracking-[0.06em]",
  lg: "text-lg tracking-[0.04em]",
} as const;

export interface DataLabelProps {
  readonly children: ReactNode;
  /** Ölçek — küçük eyebrow (sm), etiket (md), veri başlığı (lg). */
  readonly size?: keyof typeof SIZES;
  /** Öğe türü; öntanımlı `span`. Başlık gerekiyorsa `as="h2"`. */
  readonly as?: ElementType;
  readonly className?: string;
}

export function DataLabel({
  children,
  size = "sm",
  as: Tag = "span",
  className = "",
}: DataLabelProps) {
  return (
    <Tag
      className={`font-display font-semibold uppercase ${SIZES[size]} ${className}`}
    >
      {children}
    </Tag>
  );
}
