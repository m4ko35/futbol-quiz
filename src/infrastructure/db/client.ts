import { PrismaClient } from "@/generated/prisma";
import { serverEnv } from "../config/env";
import { resolveDatabaseUrl } from "./database-url";

/**
 * Tekil PrismaClient örneği.
 *
 * Neden global? Geliştirmede Next.js her sıcak yenilemede (HMR) modülleri
 * yeniden değerlendirir. Her seferinde `new PrismaClient()` çağrılsaydı
 * bağlantılar birikip veritabanını tüketirdi. Üretimde modül bir kez
 * yüklendiği için global saklamaya gerek yoktur.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Adres açıkça veriliyor: sunucusuz dağıtımda göreli yol çözümlemesi
    // Prisma'ya bırakılamaz (bkz. database-url.ts).
    datasourceUrl: resolveDatabaseUrl(serverEnv().DATABASE_URL),
    // Üretimde sorgu logu tutulmaz: hem gürültü hem de sorgu metinleri
    // üzerinden veri sızıntısı riski (§7.8).
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
