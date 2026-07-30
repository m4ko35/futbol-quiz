import { createHash } from "node:crypto";

/**
 * Wikidata arma adresini gösterilebilir bir adrese çevirir (PROJECT.md §7.3).
 *
 * SORUN. `P154` şu biçimde geliyor:
 *
 *   http://commons.wikimedia.org/wiki/Special:FilePath/Logo%20of%20AC%20Milan.svg
 *
 * Bu adres iki kez kullanılamaz durumda: (1) şeması `http`, (2) konağı
 * `commons.wikimedia.org`. CSP'nin `img-src` beyaz listesi ise
 * `https://upload.wikimedia.org`. Sonuç: 114 armanın 114'ü engelleniyordu.
 *
 * NEDEN BEYAZ LİSTE GENİŞLETİLMEDİ. `commons.wikimedia.org` eklemek iki satırlık
 * bir düzeltme olurdu ama yanlış olurdu: `Special:FilePath` bir YÖNLENDİRMEdir,
 * yani her arma için fazladan bir gidiş-dönüş demektir, ve `http` şeması karışık
 * içerik (mixed content) uyarısı üretir. Beyaz listeyi gevşetmek yerine veri
 * düzeltiliyor — güvenlik sınırını veri hatasına uydurmak yanlış yöndür.
 *
 * ÇÖZÜM. Commons'ın dosya yolu şeması belgelidir ve deterministiktir: dosya adı
 * (boşluklar alt çizgi) MD5'lenir, ilk karakter ve ilk iki karakter dizin adı
 * olur. Ağa çıkmadan, yerelde hesaplanabilir.
 *
 *   Logo_of_AC_Milan.svg → md5 = d0e4c1…
 *   → https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg
 *
 * RASTER İÇİN KÜÇÜK BOY. Ölçüldü: 114 armanın 78'i SVG (1–9 KB), 36'sı PNG/JPG
 * ve bunlar büyük — 1899 Hoffenheim'ın PNG'si 172 KB. SVG doğrudan verilir
 * (ölçeklenebilir ve zaten küçük); raster dosyalar Commons'ın küçük resim
 * uçlarından {@link THUMB_WIDTH} genişliğinde istenir. §1.4'teki LCP < 2 sn
 * hedefi, seçim listesinde onlarca armanın aynı anda inmesiyle çelişirdi.
 */

/**
 * Küçük resim genişliği — KEYFİ SEÇİLEMEZ.
 *
 * İlk deneme 96 px'di ve 114 adresin tamamı `400 Bad Request` döndü. Hata
 * gövdesi sebebi söylüyordu: "Use thumbnail sizes listed on
 * https://w.wiki/GHai" — Wikimedia yalnızca belirli genişliklere izin veriyor.
 * Ölçüldü (2026-07-30):
 *
 *   64 ✗   96 ✗   100 ✗   120 ✓   128 ✗   160 ✗   200 ✗   250 ✓   256 ✗   320 ✗
 *
 * 120 seçildi: arayüzde arma küçük gösteriliyor, 250 gereksiz yere ~2,5 kat
 * ağır. Bu sayı bir üslup tercihi değil bir KISITTIR; değiştirilecekse önce
 * yukarıdaki ölçüm tekrarlanmalıdır.
 */
const THUMB_WIDTH = 120;

const FILE_PATH_PATTERN = /\/Special:FilePath\/(.+)$/u;

/** Küçük resim üretilemeyen biçimler — doğrudan verilir. */
const VECTOR_EXTENSIONS = new Set(["svg"]);

export function toCommonsFileUrl(raw: string | null): string | null {
  if (raw === null) return null;

  const match = FILE_PATH_PATTERN.exec(raw);
  // Beklenmeyen bir biçim geldiyse UYDURULMAZ: `null` dönerek armasız
  // gösterilir. Yanlış bir adres, boş bir armadan daha kötüdür — bozuk resim
  // ikonu kullanıcıya sitenin çalışmadığını söyler (§2.7).
  if (match?.[1] === undefined) return null;

  let fileName: string;
  try {
    fileName = decodeURIComponent(match[1]).replaceAll(" ", "_");
  } catch {
    // Bozuk yüzde kodlaması: `decodeURIComponent` fırlatır.
    return null;
  }
  if (fileName.length === 0 || fileName.includes("/")) return null;

  const hash = createHash("md5").update(fileName, "utf8").digest("hex");
  const dir = `${hash[0] ?? ""}/${hash.slice(0, 2)}`;
  const encoded = encodeURIComponent(fileName);

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (VECTOR_EXTENSIONS.has(extension)) {
    return `https://upload.wikimedia.org/wikipedia/commons/${dir}/${encoded}`;
  }

  return (
    `https://upload.wikimedia.org/wikipedia/commons/thumb/${dir}/${encoded}` +
    `/${THUMB_WIDTH}px-${encoded}`
  );
}
