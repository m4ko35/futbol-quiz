import type { MetadataRoute } from "next";
import { connection } from "next/server";
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
 *
 * NEDEN `connection()`. Next `robots.js`'i öntanımlı olarak ÖNBELLEĞE ALIR ve
 * gövdeyi derleme çıktısına gömer; sayfa meta etiketi ise her istekte okunur.
 * İkisi aynı değeri okuduğu hâlde farklı ZAMANLARDA okuyordu ve ölçüm ayrışmayı
 * doğruladı: derleme `SITE_INDEXABLE` olmadan yapılıp çalışma anında `true`
 * verildiğinde `robots.txt` "Disallow: /" derken sayfa "index, follow" diyordu.
 * Tarayıcı `robots.txt`'ye uyup sayfayı hiç çekmediği için site kapalı kalır
 * ama açıldığı sanılırdı — sessiz bir yayın arızası (§7.11).
 *
 * `connection()` Next 16'nın dinamik render işaretidir; `export const dynamic`
 * segment yapılandırmadan kaldırıldı.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
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
