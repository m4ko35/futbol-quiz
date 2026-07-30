import type { MetadataRoute } from "next";
import { serverEnv } from "@/infrastructure/config/env";

/**
 * `robots.txt` — PROJECT.md §7.11.
 *
 * Değer `SITE_INDEXABLE` ortam değişkeninden gelir; sayfa meta etiketi de
 * (`layout.tsx`) aynı değeri okur. Tek anahtar, iki etki.
 *
 * NEDEN İKİSİ BİRDEN. `robots.txt` yalnızca TARAMAYI engeller, İNDEKSLEMEYİ
 * değil: başka bir siteden bağlantı verilmiş bir adres, içeriği hiç
 * okunmadan da arama sonuçlarında görünebilir. İndekslemeyi asıl engelleyen
 * `noindex` meta etiketidir. İkisi birlikte kullanılıyor çünkü bu aşamada
 * siteye dışarıdan bağlantı yok; tarama trafiğini baştan kesmek de
 * gereksiz yük getirmiyor.
 */
export default function robots(): MetadataRoute.Robots {
  const { SITE_INDEXABLE, SITE_URL } = serverEnv();

  if (!SITE_INDEXABLE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // API uçları insan için değil; taranmaları hem anlamsız hem de hız
      // sınırını gereksiz yere tüketir (§7.5).
      disallow: "/api/",
    },
    host: SITE_URL,
  };
}
