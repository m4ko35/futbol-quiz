import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { serverEnv } from "@/infrastructure/config/env";
import { datasets } from "@/infrastructure/db/repositories";

/**
 * `sitemap.xml` — PROJECT.md §7.11.
 *
 * `robots.ts` İLE AYNI KAPI. Değer `SITE_INDEXABLE`'dan gelir ve `false` iken
 * harita BOŞTUR: `robots.txt` "Disallow: /" derken adres listeleyen bir site
 * haritası çelişkilidir ve tarayıcıyı yanıltır. İki çıktının AYNI ANDA
 * okunması gerektiği için burada da `connection()` kullanılıyor — gerekçe
 * `robots.ts`'te ayrıntılı (Next `sitemap.js`'i öntanımlı önbelleğe alır;
 * derleme anındaki değer çalışma anındakinden ayrışabilirdi).
 *
 * Yalnızca İNDEKSLENEBİLİR sayfalar listelenir. Giriş/oda/hesap gibi `noindex`
 * sayfalar (kendi meta etiketlerinde `index: false`) haritada YOKTUR —
 * indekslenmesini istemediğimiz bir adresi haritaya koymak ters sinyaldir.
 */

/**
 * `lastmod`, veri kümesinin üretim tarihidir: bu sayfaların içeriği ancak yeni
 * bir veri çekimiyle değişir (§3.1), dolayısıyla doğru "son değişiklik" sinyali
 * budur — her istekte `new Date()` vermek sahte bir tazelik iddiası olurdu.
 */
const INDEXABLE_PATHS = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/izgara", changeFrequency: "daily", priority: 0.9 },
  { path: "/istatistik", changeFrequency: "daily", priority: 0.9 },
  { path: "/hangisi-daha", changeFrequency: "daily", priority: 0.9 },
  { path: "/lider-tablosu", changeFrequency: "daily", priority: 0.6 },
  { path: "/kaynaklar", changeFrequency: "yearly", priority: 0.3 },
  { path: "/gizlilik", changeFrequency: "yearly", priority: 0.3 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const { SITE_INDEXABLE, SITE_URL } = serverEnv();
  if (!SITE_INDEXABLE) return [];

  const generatedAt = await datasets.getGeneratedAt();
  const base = SITE_URL.replace(/\/$/u, "");

  return INDEXABLE_PATHS.map((entry) => ({
    url: `${base}${entry.path}`,
    ...(generatedAt === null ? {} : { lastModified: generatedAt }),
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
