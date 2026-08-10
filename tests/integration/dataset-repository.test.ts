import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaDatasetRepository } from "@/infrastructure/db/repositories/prisma-dataset-repository";
import {
  createTestDatabase,
  type TestDatabase,
} from "../helpers/test-database";

/**
 * Künye port'u — PROJECT.md §4.1, §5.2.
 *
 * `countSelectableClubs` ARAYÜZDEKİ KAPSAM BİLDİRİMİNİ besliyor ve o metin
 * kullanıcının siteye duyduğu güvenin ölçüsü: sayı sayfaya elle yazılmıştı
 * ("345 kulüp") ve kapsam genişletilmeden çok önce eskimişti (§1.3).
 *
 * Sınanan asıl şey sayım değil SÜZGEÇ: seçilemez kulüpler kullanıcıya hiç
 * sunulmuyor, dolayısıyla sayıya girmemeleri gerekir. Süzgeci kaldıran bir
 * değişiklik sayıyı sessizce şişirirdi ve hiçbir tip hatası vermezdi.
 */

let db: TestDatabase;
let repository: PrismaDatasetRepository;

beforeAll(async () => {
  db = createTestDatabase();
  repository = new PrismaDatasetRepository(db.prisma);

  const league = await db.prisma.league.create({
    data: {
      wikidataId: "Q9448",
      name: "Premier League",
      country: "GB",
      tier: 1,
    },
  });

  await db.prisma.club.createMany({
    data: [
      club("Q1", "Arsenal", true, league.id),
      club("Q2", "Chelsea", true, league.id),
      // Tarihsel artık: veri kümesinde var, seçim listesinde YOK (§1.3).
      club("Q3", "SC Fives", false, league.id),
    ],
  });

  await db.prisma.player.createMany({
    data: [
      player("Q10", "Thierry Henry"),
      player("Q11", "Dennis Bergkamp"),
      player("Q12", "Didier Drogba"),
      player("Q13", "Frank Lampard"),
    ],
  });
});

afterAll(async () => {
  await db.destroy();
});

function player(wikidataId: string, name: string) {
  return { wikidataId, name, searchKey: name.toLowerCase() };
}

function club(
  wikidataId: string,
  name: string,
  isSelectable: boolean,
  leagueId: string,
) {
  return {
    wikidataId,
    name,
    shortName: name,
    searchKey: name.toLowerCase(),
    country: "GB",
    isSelectable,
    leagueId,
  };
}

describe("PrismaDatasetRepository", () => {
  it("yalnızca seçilebilir kulüpleri sayar", async () => {
    // 3 kulüp var, 2'si seçilebilir. Süzgeç kalkarsa bu 3 olurdu.
    await expect(repository.countSelectableClubs()).resolves.toBe(2);
  });

  it("oyuncuları SÜZGEÇSİZ sayar", async () => {
    /*
     * Kulüplerdeki `isSelectable` karşılığı oyuncuda YOK ve olmamalı: kullanıcı
     * oyuncuyu bir listeden seçmiyor, oyuncu bir sonuçta karşısına çıkıyor.
     * Buraya bir süzgeç eklenirse künye tabelasındaki sayı ile sonuçlarda
     * görülebilecek oyuncu kümesi ayrışır — sayı sessizce yalan söylemeye
     * başlar ve hiçbir tip hatası vermez.
     */
    await expect(repository.countPlayers()).resolves.toBe(4);
  });

  it("künye yazılmamışsa tarih UYDURMAZ", async () => {
    // §2.7: bilinmeyen tarih `null` döner; "bugün" varsayılan olsaydı bir yıl
    // önce üretilmiş veri kümesi taze görünürdü.
    await expect(repository.getGeneratedAt()).resolves.toBeNull();
  });

  it("künye yazılmışsa okunur", async () => {
    const generatedAt = new Date("2026-08-06T10:00:00.000Z");
    await db.prisma.datasetMeta.create({ data: { id: 1, generatedAt } });

    await expect(repository.getGeneratedAt()).resolves.toEqual(generatedAt);
  });
});
