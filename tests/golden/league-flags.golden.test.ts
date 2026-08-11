import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import { availableFlagCodes, flagCodeFor } from "@/lib/country-flag";

/**
 * BR-39 — her ligin bayrağı GERÇEKTEN var mı? (§7.14)
 *
 * NEDEN DOĞRULUK TESTİ. `country-flag.ts`'teki kod listesi ELLE tutuluyor ve
 * elle tutulan her liste sessizce eskiyebilir: veri tazelendiğinde yeni bir
 * ülkeden lig gelirse arayüzde bayrak yuvası boş kalır. Birim testi bunu
 * göremez — listeyle kendisini kıyaslar, veriyle değil.
 *
 * İki yönlü denetleniyor:
 *   1. Veritabanındaki her lig bir bayrak kodu üretiyor mu?
 *   2. O kodun `public/flags/` altında dosyası var mı?
 *
 * İkincisi ayrı bir soru: liste bir kodu "var" sayarken dosya silinmiş olabilir.
 *
 * Veritabanı yoksa ATLANIR — ETL çıktısı depoya girmez (golden testlerin
 * ortak gerekçesi).
 */

const DB_PATH = path.join(process.cwd(), "prisma", "dev.db");
const FLAG_DIR = path.join(process.cwd(), "public", "flags");
const hasDatabase = existsSync(DB_PATH);

let prisma: PrismaClient;

beforeAll(() => {
  if (!hasDatabase) return;
  prisma = new PrismaClient({
    datasources: { db: { url: `file:${DB_PATH}` } },
  });
});

afterAll(async () => {
  if (!hasDatabase) return;
  await prisma.$disconnect();
});

describe.skipIf(!hasDatabase)("lig bayrakları — gerçek veri", () => {
  it("SEÇİLEBİLİR kulübü olan her lig bir bayrak kodu üretir", async () => {
    const leagues = await prisma.league.findMany({
      select: {
        wikidataId: true,
        name: true,
        country: true,
        _count: { select: { clubs: { where: { isSelectable: true } } } },
      },
    });

    const visible = leagues.filter((league) => league._count.clubs > 0);
    expect(visible.length).toBeGreaterThan(0);

    const missing = visible
      .filter((league) => flagCodeFor(league) === null)
      .map((league) => `${league.name} (${league.country})`);

    // Hata mesajı HANGİ ligin eksik olduğunu söylüyor: "bir yerde bayrak yok"
    // demek, düzeltmeyi arayan kişiye hiçbir şey vermez.
    expect(missing).toEqual([]);
  });

  it("üretilen her kod için dosya GERÇEKTEN var", async () => {
    const leagues = await prisma.league.findMany({
      select: { wikidataId: true, country: true },
    });

    const codes = [
      ...new Set(
        leagues
          .map((league) => flagCodeFor(league))
          .filter((code): code is string => code !== null),
      ),
    ].sort();

    const missingFiles = codes.filter(
      (code) => !existsSync(path.join(FLAG_DIR, `${code}.svg`)),
    );

    expect(missingFiles).toEqual([]);
  });

  /**
   * ÖLÇÜLMÜŞ KUSUR (§7.14): `GB` iki lige birden düşüyor. Bu test kusurun
   * veride HÂLÂ var olduğunu — yani istisnanın hâlâ gerekli olduğunu —
   * doğruluyor. Veri bir gün ayrışırsa test kırılır ve istisna gözden
   * geçirilir; sessizce gereksiz bir tabloyla yaşamaktan iyidir.
   */
  it("aynı ülke kodunu paylaşan ligler ayrı bayrak alır", async () => {
    const leagues = await prisma.league.findMany({
      select: {
        wikidataId: true,
        name: true,
        country: true,
        _count: { select: { clubs: { where: { isSelectable: true } } } },
      },
    });

    const visible = leagues.filter((league) => league._count.clubs > 0);

    const byCountry = new Map<string, typeof visible>();
    for (const league of visible) {
      byCountry.set(league.country, [
        ...(byCountry.get(league.country) ?? []),
        league,
      ]);
    }

    for (const [, shared] of byCountry) {
      if (shared.length < 2) continue;

      const codes = shared.map((league) => flagCodeFor(league));
      expect(new Set(codes).size).toBe(shared.length);
    }
  });
});

describe("bayrak listesi", () => {
  it("listedeki her kodun dosyası var", () => {
    const missing = availableFlagCodes().filter(
      (code) => !existsSync(path.join(FLAG_DIR, `${code}.svg`)),
    );

    expect(missing).toEqual([]);
  });

  it("MIT künyesi bayraklarla birlikte taşınıyor", () => {
    // `flag-icons` MIT lisanslı ve MIT telif bildiriminin korunmasını ŞART
    // koşuyor. Künye dosyası silinirse lisans ihlali sessizdir (§7.14).
    expect(existsSync(path.join(FLAG_DIR, "LICENSE.txt"))).toBe(true);
  });
});
