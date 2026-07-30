import path from "node:path";

/**
 * `DATABASE_URL`'i çalışma zamanında MUTLAK bir adrese çevirir (§3.1).
 *
 * NEDEN GEREKLİ. Prisma, göreli bir SQLite yolunu `schema.prisma`'nın bulunduğu
 * klasöre göre çözer. Bu, CLI için doğru davranıştır ama sunucusuz dağıtımda
 * güvenilmezdir: fonksiyon paketinde şema dosyası bulunmaz ve çalışma klasörü
 * yerel geliştirmedekiyle aynı değildir. Yol orada çözülemezse uygulama
 * "veritabanı yok" diye ölür — hem de yalnızca üretimde.
 *
 * ÇÖZÜM. Çözümleme Prisma'ya bırakılmaz, BURADA yapılır ve her ortamda aynı
 * kuralı uygular: göreli yol, `schema.prisma`'nın klasörüne (`prisma/`) göre
 * çözülür ve `process.cwd()` ile mutlaklaştırılır. Böylece tek bir
 * `DATABASE_URL` değişkeni hem Prisma CLI'ı hem uygulamayı aynı dosyaya
 * götürür; iki ayrı değişken tutup birbirinden ayrışmalarına izin vermek
 * gerekmez.
 *
 * SINIR. `process.cwd()`'nin dağıtımda proje köküne denk geldiği varsayılıyor;
 * `outputFileTracingIncludes` dosyayı oraya göre yerleştiriyor (§3.1). Bu
 * varsayım ilk dağıtımda ÖLÇÜLECEK (Faz 4.5) — yanlışsa buradaki taban
 * klasör değişir, çağıranlar değişmez.
 *
 * DERLEME UYARISI. Buradaki `path.resolve` Turbopack'in "bütün proje izlenmiş
 * olabilir" uyarısını tetikliyor. Uyarı ölçülerek karşılandı: izlenen dosya
 * sayısı 280 ve toplam 125,4 MB — şişme yok (§3.1'deki döküm). Uyarıyı
 * susturmak için yolu sabitlemek, çalışma klasörünü okumaktan vazgeçmek
 * demekti; o da tam olarak bu fonksiyonun çözdüğü sorunu geri getirirdi.
 */

/** Şema dosyasının proje köküne göre klasörü — göreli yolların tabanı. */
const SCHEMA_DIR = "prisma";

const FILE_PREFIX = "file:";

export function resolveDatabaseUrl(
  rawUrl: string,
  cwd: string = process.cwd(),
): string {
  if (!rawUrl.startsWith(FILE_PREFIX)) {
    // SQLite dışı bir sağlayıcıya (ör. Postgres) geçilirse adres olduğu gibi
    // kullanılır; dosya yolu çözümlemesi orada anlamsızdır.
    return rawUrl;
  }

  const filePath = rawUrl.slice(FILE_PREFIX.length);

  // Zaten mutlaksa dokunulmaz: dağıtım ortamı tam yolu verebilmelidir.
  if (path.isAbsolute(filePath)) return rawUrl;

  // DÜZ DOSYA YOLU üretilir, `file://` URL'i değil. Prisma'nın SQLite
  // bağlayıcısı `file:` önekinden sonrasını doğrudan dosya yolu olarak okur.
  // İlk sürüm `pathToFileURL().pathname` kullanıyordu ve Windows'ta başa bir
  // `/` ekliyordu (`file:/C:/...`); derleme "Error code 14: Unable to open the
  // database file" ile düştü. Yüzde kodlaması da YAPILMAZ — yol bir URL değil.
  return `${FILE_PREFIX}${path.resolve(cwd, SCHEMA_DIR, filePath)}`;
}
