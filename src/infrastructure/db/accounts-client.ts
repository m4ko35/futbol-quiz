import { PrismaLibSQL } from "@prisma/adapter-libsql/web";
import { PrismaClient } from "@/generated/prisma-accounts";
import { accountsEnv } from "../config/env";

/**
 * Hesap veritabanı istemcisi — PROJECT.md §11.3.
 *
 * FUTBOL VERİSİNDEN AYRI BİR İSTEMCİ ve ayrılık kasıtlı: `client.ts` pakete
 * gömülü, salt okunur SQLite dosyasına bağlanır ve ağ turu içermez (§3.1).
 * Buradaki istemci Turso'ya ağ üzerinden bağlanır ve YAZAR. İkisini tek
 * istemcide birleştirmek, futbol sorgularını da ağa çıkarırdı.
 *
 * `/web` GİRİŞİ KULLANILIYOR, düğüm girişi değil. Fark ölçüldü: düğüm girişi
 * `libsql` yerel ikilisini (7,0 MB, platforma özel) içeri alır ve o ikili
 * yalnızca yerel dosya ya da gömülü kopya için gerekli. Biz her zaman
 * uzaktaki Turso'ya HTTP ile bağlanıyoruz (§11.8 paket bütçesi).
 */

/**
 * Geliştirmede sıcak yenileme her seferinde modülü yeniden değerlendirir;
 * `client.ts` ile aynı gerekçe. Burada bedeli daha yüksek ve bedel ÜRETİMDE
 * ÖLÇÜLDÜ: yeni bir istemcinin ilk sorgusu **459 ms**, aynı istemcinin
 * sonraki sorguları 6 ms (§11.3). Yani bu önbellek bir geliştirme kolaylığı
 * değil, TAŞIYICI bir karardır — kaldırılırsa her istek 459 ms öder.
 *
 * Maliyetin ADI KONMUŞ DEĞİL. Önceki yorum "TLS el sıkışması" diyordu; o
 * iddia ölçümden fazlasıydı ve çürüdü — el sıkışma mesafeye bağlıdır, oysa
 * aynı sayı hem Türkiye'den hem Dublin'in içinden çıktı. Bilinen: maliyet
 * Prisma'nın motorunda değil (ham libSQL de aynı deseni gösteriyor), bağlantı
 * katmanında; katmanın içi ayrıştırılmadı.
 */
const globalForAccounts = globalThis as unknown as {
  accountsPrisma: PrismaClient | undefined;
};

/**
 * İstemciyi döner; hesap özelliği kapalıysa `null`.
 *
 * `null` BİR HATA DEĞİLDİR (bkz. `accountsEnv`). Çağıran özelliği gizler ya da
 * `404` döner. Buradan hata fırlatmak, hesapsız bir kurulumda her isteği
 * `500`'e çevirirdi — oysa yanlış olan bir şey yok.
 *
 * TEMBEL KURULUM: modül yüklenirken değil, ilk çağrıda bağlanılır. Aksi hâlde
 * hesap özelliğine hiç dokunmayan bir istek (ızgara, arama, kulüp sayfası) da
 * bağlantı kurmuş olurdu.
 */
export function accountsPrisma(): PrismaClient | null {
  if (globalForAccounts.accountsPrisma !== undefined) {
    return globalForAccounts.accountsPrisma;
  }

  const env = accountsEnv();
  if (env === null) return null;

  const client = new PrismaClient({
    adapter: new PrismaLibSQL({
      url: env.databaseUrl,
      authToken: env.databaseToken,
    }),
    // Üretimde sorgu logu tutulmaz: `client.ts` ile aynı gerekçe (§7.8).
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  globalForAccounts.accountsPrisma = client;
  return client;
}
