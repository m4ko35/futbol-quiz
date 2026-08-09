import type { ClubDto } from "@/application/dto/club-dto";
import { clubInitials } from "@/lib/club-initials";

/**
 * Kulüp işareti — PROJECT.md §7.13, BR-35.
 *
 * YUVA HEP DOLU. Önceki bileşen (`ClubCrest`) arma yoksa boş bir kare
 * bırakıyordu: hizalama doğruydu ama armanın kapsamı %43,7 olduğu için
 * listelerin yarısı delik görünüyordu. Üstelik delikler rastgele dağılmıyor —
 * Manchester United ve Arsenal boşken küçük kulüpler doluydu (§4.3.1).
 *
 * NEDEN RENK YOK. Forma renkleri denendi ve ölçümle elendi: bilgi kutusundaki
 * `body1` alanı desenli formalarda tasarımın tabanını verir, kimliğini değil
 * (Galatasaray lacivert, Juventus renksiz çıkıyordu). Ayrıntı ve sayılar
 * §7.13'te. Uydurulmuş bir renk, yanlış arma ile aynı sınıfta bir hatadır.
 *
 * NEDEN `next/image` DEĞİL. Görsel iyileştirici uzak kaynaklar için ayrı
 * yapılandırma (`remotePatterns`) ve çalışma zamanında bir dönüştürme adımı
 * ister. Buradaki dosyalar ETL'de zaten küçültülmüş durumda (SVG 1–9 KB,
 * raster 120 px küçük resim ~15 KB); iyileştiriciyi devreye almak ölçülebilir
 * bir kazanç sağlamadan bir alt sistem daha eklerdi.
 *
 * NEDEN `aria-hidden`. İşaret, yanındaki kulüp adının görsel tekrarıdır — yeni
 * bilgi taşımaz. "Galatasaray arması" diye seslendirmek ekran okuyucu
 * kullanıcısına aynı şeyi iki kez söylemek olur (WCAG 1.1.1).
 *
 * BOYUT SABİT. `width`/`height` öznitelikleri, resim inmeden önce yerin
 * ayrılmasını sağlar; olmazsa liste her arma indiğinde zıplar (CLS).
 */

export interface ClubMarkProps {
  /** `country` yalnızca baş harflerin büyük harf kuralını seçer (§7.13). */
  readonly club: Pick<ClubDto, "crestUrl" | "shortName" | "country">;
  /** Kenar uzunluğu (px). */
  readonly size?: number;
}

/**
 * Varsayılan kenar uzunluğu.
 *
 * 20 px'ten 26 px'e çıktı ve bu, üç harfli işaretin ÖNKOŞULUDUR (§7.13):
 * üç harf 20 px'lik yuvada okunmuyordu. İkisi birlikte değişir; karo
 * küçültülecekse harf sayısı da yeniden ölçülmelidir.
 */
const DEFAULT_SIZE = 26;

export function ClubMark({ club, size = DEFAULT_SIZE }: ClubMarkProps) {
  if (club.crestUrl === null) {
    const initials = clubInitials(club.shortName, club.country);

    return (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center rounded-[5px] bg-accent-soft font-semibold tracking-tight text-accent select-none"
        style={{
          width: size,
          height: size,
          // Yazı boyu hem yuvayla hem HARF SAYISIYLA ölçekleniyor: üç harf,
          // iki harfin oranında yazıldığında yuvadan taşıyor. Sabit bir
          // `text-xs` ikisinde de yanlış olurdu.
          fontSize: Math.round(size * (initials.length >= 3 ? 0.34 : 0.42)),
          lineHeight: 1,
        }}
      >
        {initials}
      </span>
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
