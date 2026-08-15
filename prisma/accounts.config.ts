import fs from "node:fs";
import path from "node:path";
import { PrismaLibSQL } from "@prisma/adapter-libsql/web";
import { defineConfig } from "prisma/config";

/**
 * Hesap veritabanının göç yapılandırması — PROJECT.md §11.3.
 *
 * NEDEN AYRI BİR YAPILANDIRMA. Futbol verisi pakete gömülü bir SQLite
 * dosyasıdır ve `prisma migrate` ona doğrudan bağlanır. Hesap verisi ise
 * Turso'da durur ve `libsql://` adresini Prisma'nın göç motoru **tek başına
 * çözemez**; bağlantıyı sürücü bağdaştırıcısı kurar. İki veritabanının iki
 * ayrı yapılandırması bu yüzden var, bir düzen tercihi değil.
 *
 * Komut:  npm run db:migrate:accounts
 *
 * `/web` GİRİŞİ KULLANILIYOR, düğüm girişi değil. İkisi arasındaki fark
 * ölçüldü: düğüm girişi `libsql` yerel ikilisini (platforma özel, ~8 MB)
 * içeri alır ve o ikili yalnızca YEREL dosya ya da gömülü kopya için gerekir.
 * Biz her zaman uzaktaki Turso'ya HTTP ile bağlanıyoruz, yani ikili hiç
 * çalışmayacak 8 MB olurdu — fonksiyon paketi bütçesi 250 MB ve marj 46 MB
 * (§11.8).
 */

/**
 * `.env` ELLE OKUNUYOR ve bu bir tercih değil zorunluluk: Prisma, bir
 * yapılandırma dosyası kullanıldığında `.env`'i artık kendiliğinden
 * yüklemiyor. `dotenv` zaten dolaylı bir bağımlılık olarak var ama doğrudan
 * ona dayanmak §7.7'nin bağımlılık disiplinine aykırı — on satırlık iş için
 * paket eklenmez, hele başkasının geçişli bağımlılığına dayanılmaz.
 */
function readEnvFile(): void {
  const file = path.join(process.cwd(), ".env");

  let contents: string;
  try {
    contents = fs.readFileSync(file, "utf8");
  } catch {
    return; // .env yoksa değerler ortamdan gelmiş olabilir.
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;

    const [, key, rawValue] = match;
    if (key === undefined || rawValue === undefined) continue;
    // Ortamda tanımlıysa DOKUNULMAZ: CI ve Vercel kendi değerini verir.
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.trim().replace(/^["']|["']$/gu, "");
  }
}

readEnvFile();

/**
 * Eksik değer SESSİZCE geçilmez.
 *
 * Adres tanımsızken göç komutu, ne yaptığı belirsiz bir hatayla düşerdi;
 * burada hangi değişkenin eksik olduğu söyleniyor.
 */
function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(
      `${name} tanımlı değil. Hesap veritabanı göçü için gerekli (§11.3).`,
    );
  }
  return value;
}

/**
 * Yollar BU DOSYAYA göre çözülür, proje köküne göre değil — Prisma'nın
 * yapılandırma dosyasındaki davranışı bu ve `prisma/` önekiyle yazmak
 * `prisma/prisma/...` üretir.
 */
export default defineConfig({
  schema: "accounts.schema.prisma",
  migrations: {
    path: "accounts-migrations",
  },
  experimental: {
    adapter: true,
  },

  /**
   * `engine: "js"` OLMADAN BAĞDAŞTIRICI SESSİZCE YOK SAYILIR — ölçüldü.
   *
   * İlk denemede yalnızca `adapter` verilmişti; o alan istemci ve Studio
   * içindir. Göç motoru varsayılan olarak şemadaki `url`'i kullanır, yani
   * komut BAŞARIYLA TAMAMLANDI ve tabloları **yerel bir dosyaya** kurdu.
   * Turso'da hiçbir şey oluşmadı ve hiçbir hata çıkmadı. Bu yüzden göçten
   * sonra tablolar Turso'da ayrıca sayılıyor: "komut hata vermedi" burada
   * kanıt değildir.
   *
   * Prisma bu motoru "yeni, KARARSIZ" diye işaretliyor. Alternatifi, göç
   * SQL'ini elle üretip Turso'ya ayrı bir betikle uygulamaktı — yani kendi
   * göç koşucumuzu yazmak. Kararsız da olsa Prisma'nın kendi yolunu
   * kullanmak, sürüm yükseltmelerinde bakımı bize kalan bir kopyadan iyi.
   */
  engine: "js",

  adapter: () =>
    Promise.resolve(
      new PrismaLibSQL({
        url: required("ACCOUNTS_DATABASE_URL"),
        authToken: required("ACCOUNTS_DATABASE_TOKEN"),
      }),
    ),
});
