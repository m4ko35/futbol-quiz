import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  isCellPlayable,
  MAX_CELL_ANSWERS,
  MIN_CELL_ANSWERS,
  type GridCriterion,
} from "@/domain/services/grid";
import { clubId } from "@/domain/value-objects/identifiers";
import { toSearchKey } from "@/domain/value-objects/search-key";
import { PrismaPlayerRepository } from "@/infrastructure/db/repositories/prisma-player-repository";
import {
  createTestDatabase,
  type TestDatabase,
} from "../helpers/test-database";

/**
 * `findPlayableCriteria` port sözleşmesi — GERÇEK veritabanında (§8.1, BR-25).
 *
 * NEDEN AYRI BİR ENTEGRASYON DOSYASI. Kural iki yerde yazılı: birim
 * testlerinin gördüğü sahte depoda TypeScript'le, üretimde SQL'in `HAVING`
 * ifadesiyle. İkisi ayrışırsa seçici, cevap ucunun reddedeceği bir ızgara
 * kurdurur — bu projede üç kez ölçülmüş bir hata sınıfı (BR-16, BR-24, BR-25).
 *
 * Doğrulama SQL'i TEKRAR YAZMADAN yapılır: dönen her ölçüt için kesişim
 * `findIdsMatching` ile bağımsız olarak sayılır. Aynı sorguyu ikinci kez
 * yazmak, yalnızca kendini doğrulayan bir test üretirdi.
 */

let db: TestDatabase;
let players: PrismaPlayerRepository;

const SUTUN = "clubSutun";
const BANDDA = "clubBandda";
const AZ = "clubAz";
const COK = "clubCok";
const GIZLI = "clubGizli";

/** Bandın üstü: 150'yi aşan kesişim "soru" değil, bedava kutudur (BR-9). */
const COK_SAYI = MAX_CELL_ANSWERS + 1;

function column(): GridCriterion {
  return { type: "club", clubId: clubId(SUTUN), label: "Sütun" };
}

beforeAll(async () => {
  db = createTestDatabase();
  players = new PrismaPlayerRepository(db.prisma);

  await db.prisma.club.createMany({
    data: [
      {
        id: SUTUN,
        wikidataId: "Q-sutun",
        name: "Sütun FK",
        shortName: "Sütun",
        searchKey: toSearchKey("Sütun FK"),
        isSelectable: true,
      },
      {
        id: BANDDA,
        wikidataId: "Q-bandda",
        name: "Bandda SK",
        shortName: "Bandda",
        searchKey: toSearchKey("Bandda SK"),
        isSelectable: true,
      },
      {
        id: AZ,
        wikidataId: "Q-az",
        name: "Az SK",
        shortName: "Az",
        searchKey: toSearchKey("Az SK"),
        isSelectable: true,
      },
      {
        id: COK,
        wikidataId: "Q-cok",
        name: "Çok SK",
        shortName: "Çok",
        searchKey: toSearchKey("Çok SK"),
        isSelectable: true,
      },
      // Seçilemez kulüp kullanıcıya hiç sunulmaz (§5.3).
      {
        id: GIZLI,
        wikidataId: "Q-gizli",
        name: "Gizli SK",
        shortName: "Gizli",
        searchKey: toSearchKey("Gizli SK"),
        isSelectable: false,
      },
    ],
  });

  /** Sütunda VE verilen kulüpte oynayan `count` oyuncu üretir. */
  const pair = async (
    other: string,
    count: number,
    nationality: string,
  ): Promise<void> => {
    for (let i = 0; i < count; i++) {
      const id = `p-${other}-${String(i)}`;
      await db.prisma.player.create({
        data: {
          id,
          wikidataId: `WD-${id}`,
          name: `Oyuncu ${other} ${String(i)}`,
          searchKey: toSearchKey(`Oyuncu ${other} ${String(i)}`),
          nationality,
          spells: {
            create: [
              {
                wikidataStatementId: `${id}-s`,
                clubId: SUTUN,
                startYear: 2010,
                endYear: 2012,
              },
              {
                wikidataStatementId: `${id}-o`,
                clubId: other,
                startYear: 2013,
                endYear: 2015,
              },
            ],
          },
        },
      });
    }
  };

  await pair(BANDDA, MIN_CELL_ANSWERS, "TR");
  await pair(AZ, MIN_CELL_ANSWERS - 1, "FR");
  await pair(COK, COK_SAYI, "DE");
  await pair(GIZLI, MIN_CELL_ANSWERS, "IT");
});

afterAll(async () => {
  await db.destroy();
});

describe("findPlayableCriteria — port sözleşmesi (BR-25)", () => {
  it("dönen HER ölçüt gerçekten bandın içinde kesişir", async () => {
    const criteria = await players.findPlayableCriteria({
      against: [column()],
      term: null,
      limit: 50,
    });

    expect(criteria.length).toBeGreaterThan(0);

    const sutunSet = new Set(await players.findIdsMatching(column()));
    for (const criterion of criteria) {
      const ids = await players.findIdsMatching(criterion);
      const ortak = ids.filter((id) => sutunSet.has(id)).length;
      // Sözleşme: seçiciden dönen her ölçüt oynanabilir bir hücre kurar.
      expect(
        isCellPlayable(ortak),
        `${criterion.label} → ${String(ortak)}`,
      ).toBe(true);
    }
  });

  it("bandın altında ve üstünde kalan kulüpler dışarıda kalır", async () => {
    const ids = (
      await players.findPlayableCriteria({
        against: [column()],
        term: null,
        limit: 50,
      })
    ).map((one) => (one.type === "club" ? String(one.clubId) : one.code));

    expect(ids).toContain(BANDDA);
    // Alt sınır: tek cevaplı hücre bilgi değil ŞANS sorar.
    expect(ids).not.toContain(AZ);
    // Üst sınır: 150'yi aşan hücre bedava kutudur — ölçümde bu sınır ikiz
    // kulüpleri de eliyor (§9.1).
    expect(ids).not.toContain(COK);
  });

  it("seçilemez kulüp aday olmaz", async () => {
    const ids = (
      await players.findPlayableCriteria({
        against: [column()],
        term: null,
        limit: 50,
      })
    ).map((one) => (one.type === "club" ? String(one.clubId) : one.code));

    expect(ids).not.toContain(GIZLI);
  });

  it("kısıtın kendisi aday olmaz", async () => {
    const ids = (
      await players.findPlayableCriteria({
        against: [column()],
        term: null,
        limit: 50,
      })
    ).map((one) => (one.type === "club" ? String(one.clubId) : one.code));

    expect(ids).not.toContain(SUTUN);
  });

  it("uyruklar da band denetiminden geçer", async () => {
    const codes = (
      await players.findPlayableCriteria({
        against: [column()],
        term: null,
        limit: 50,
      })
    )
      .filter((one) => one.type === "nationality")
      .map((one) => (one.type === "nationality" ? one.code : ""));

    // Bandda kulübünün oyuncuları TR: sütunla kesişimleri tam alt sınırda.
    expect(codes).toContain("TR");
    // FR yalnızca alt sınırın altındaki oyuncularda, DE ise üst sınırın
    // üstünde.
    expect(codes).not.toContain("FR");
    expect(codes).not.toContain("DE");
  });

  it("arama metni Türkçe normalizasyonla süzer", async () => {
    const criteria = await players.findPlayableCriteria({
      against: [column()],
      term: "bandda",
      limit: 50,
    });

    // "Bandda" aramasında ne diğer kulüpler ne de uyruklar kalmalı.
    expect(criteria).toHaveLength(1);
    expect(criteria[0]?.label).toBe("Bandda");
  });

  it("iki kısıt verildiğinde İKİSİYLE birden kesişenler döner", async () => {
    const ikinci: GridCriterion = {
      type: "club",
      clubId: clubId(BANDDA),
      label: "Bandda",
    };

    const criteria = await players.findPlayableCriteria({
      against: [column(), ikinci],
      term: null,
      limit: 50,
    });

    // Boş liste bu testi hiçbir şey söylemeden geçirirdi.
    expect(criteria.length).toBeGreaterThan(0);

    const sutunSet = new Set(await players.findIdsMatching(column()));
    const banddaSet = new Set(await players.findIdsMatching(ikinci));

    for (const criterion of criteria) {
      const ids = await players.findIdsMatching(criterion);
      expect(isCellPlayable(ids.filter((id) => sutunSet.has(id)).length)).toBe(
        true,
      );
      expect(isCellPlayable(ids.filter((id) => banddaSet.has(id)).length)).toBe(
        true,
      );
    }
  });
});
