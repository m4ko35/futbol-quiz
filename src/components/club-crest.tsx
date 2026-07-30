import type { ClubDto } from "@/application/dto/club-dto";

/**
 * Kulüp arması — PROJECT.md §7.3.
 *
 * NEDEN `next/image` DEĞİL. Görsel iyileştirici uzak kaynaklar için ayrı
 * yapılandırma (`remotePatterns`) ve çalışma zamanında bir dönüştürme adımı
 * ister. Buradaki dosyalar ETL'de zaten küçültülmüş durumda (SVG 1–9 KB,
 * raster 120 px küçük resim ~15 KB); iyileştiriciyi devreye almak ölçülebilir
 * bir kazanç sağlamadan bir alt sistem daha eklerdi.
 *
 * NEDEN `alt=""`. Arma, yanındaki kulüp adının görsel tekrarıdır — yeni bilgi
 * taşımaz. "Galatasaray arması" diye seslendirmek ekran okuyucu kullanıcısına
 * aynı şeyi iki kez söylemek olur. WAI-ARIA'nın süsleme (decorative) kuralı
 * gereği boş `alt` doğru olandır (WCAG 1.1.1).
 *
 * BOYUT SABİT. `width`/`height` öznitelikleri, resim inmeden önce yerin
 * ayrılmasını sağlar; olmazsa liste her arma indiğinde zıplar (CLS).
 */

export interface ClubCrestProps {
  readonly club: Pick<ClubDto, "crestUrl">;
  /** Kenar uzunluğu (px). */
  readonly size?: number;
}

export function ClubCrest({ club, size = 20 }: ClubCrestProps) {
  // Arması olmayan kulüpte de yer AYRILIR: aksi hâlde listedeki adlar
  // armalıyla armasız arasında kayar ve göz taraması zorlaşır.
  if (club.crestUrl === null) {
    return (
      <span
        aria-hidden="true"
        className="inline-block shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // Kural bilinçli olarak susturuluyor: uyarı `next/image` kullanılmadığında
    // LCP'nin kötüleşebileceğini söylüyor, ama buradaki dosyalar ETL'de zaten
    // küçültüldü (yukarıdaki gerekçe). Ölçülebilir bir kazanç olmadan bir alt
    // sistem eklemek §2'deki bağımlılık disiplinine aykırı olurdu.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={club.crestUrl}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="inline-block shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
