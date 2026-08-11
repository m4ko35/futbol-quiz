import { flagCodeFor, flagUrl, type FlagSubject } from "@/lib/country-flag";

/**
 * Lig bayrağı — PROJECT.md §7.14, BR-39.
 *
 * SÖZLEŞMESİ `ClubMark` İLE AYNI ve bu tesadüf değil: ikisi de bir listede
 * adın yanında duran, adı TEKRARLAYAN küçük bir işaret. Aynı sorunları aynı
 * biçimde çözmeleri gerekiyor.
 *
 * · `alt=""` + `aria-hidden` — ülke adı bayrağın yanında YAZILI. Ekran
 *   okuyucuya "Türkiye bayrağı, Türkiye" demek aynı şeyi iki kez söylemektir
 *   (WCAG 1.1.1). Bayrak bilgiyi taşımıyor, tekrarlıyor.
 * · Sabit `width`/`height` — resim inmeden yer ayrılır; olmazsa lig listesi
 *   her bayrak indiğinde zıplar (CLS).
 * · `loading="lazy"` — kademe 1'de yirmi dört satır birden var.
 *
 * NEDEN `next/image` DEĞİL. `ClubMark`'takiyle aynı gerekçe: dosyalar zaten
 * küçük (25 bayrak toplam 39,6 KB gzip) ve yereldir. İyileştirici, ölçülebilir
 * bir kazanç sağlamadan bir alt sistem daha eklerdi.
 *
 * ORAN 4:3. Bayraklar aynı orandan çiziliyor ki liste kolonu hizalı kalsın;
 * gerçek oranları farklı olsa da (İsviçre kare, Danimarka 37:28) tek tek
 * oranlamak satırları oynatırdı.
 */

export interface CountryFlagProps {
  readonly league: FlagSubject;
  /** Genişlik (px); yükseklik 4:3 oranından türer. */
  readonly width?: number;
}

const DEFAULT_WIDTH = 20;

export function CountryFlag({
  league,
  width = DEFAULT_WIDTH,
}: CountryFlagProps) {
  const code = flagCodeFor(league);

  // Dosyası olmayan ülke için KIRIK GÖRSEL değil, hiçbir şey. Boş yuva
  // sessizdir; kırık simge kusurlu görünür (§7.13).
  if (code === null) return null;

  const height = Math.round((width * 3) / 4);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Yerel, küçük ve sabit boyutlu; iyileştiriciye gerek yok (§7.14).
    <img
      src={flagUrl(code)}
      alt=""
      aria-hidden="true"
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className="shrink-0 rounded-[2px] object-cover ring-1 ring-line"
      style={{ width, height }}
    />
  );
}
