import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toSearchKey } from "@/domain/value-objects/search-key";
import { PrismaClubRepository } from "@/infrastructure/db/repositories/prisma-club-repository";
import {
  createTestDatabase,
  type TestDatabase,
} from "../helpers/test-database";

/**
 * §7.3, BR-34 — arma atıf künyeleri.
 *
 * Port sözleşmesi "künyesi TAM olanlar döner" diyor; bu ancak gerçek bir
 * veritabanında, eksik künyeli satırlar da varken denetlenebilir.
 */

let db: TestDatabase;
let repository: PrismaClubRepository;

const COMMONS = "https://upload.wikimedia.org/wikipedia/commons/a/ab/";

beforeAll(async () => {
  db = createTestDatabase();
  repository = new PrismaClubRepository(db.prisma);

  await db.prisma.club.createMany({
    data: [
      {
        id: "tam-b",
        wikidataId: "Q-tam-b",
        name: "Bursaspor",
        shortName: "Bursaspor",
        searchKey: toSearchKey("Bursaspor"),
        isSelectable: true,
        crestUrl: `${COMMONS}Bursa.svg`,
        crestLicense: "CC BY-SA 4.0",
        crestAuthor: "Bir Yazar",
        crestFilePage: "https://commons.wikimedia.org/wiki/File:Bursa.svg",
      },
      {
        id: "tam-a",
        wikidataId: "Q-tam-a",
        name: "Altay",
        shortName: "Altay",
        searchKey: toSearchKey("Altay"),
        isSelectable: true,
        crestUrl: `${COMMONS}Altay.svg`,
        crestLicense: "Public domain",
        // Kamu malında yazar anılmak zorunda değil.
        crestAuthor: null,
        crestFilePage: "https://commons.wikimedia.org/wiki/File:Altay.svg",
      },
      {
        // KÜNYESİ EKSİK: lisansı var ama dosya sayfası yok.
        id: "eksik-sayfa",
        wikidataId: "Q-eksik-sayfa",
        name: "Eksik Sayfa",
        shortName: "Eksik Sayfa",
        searchKey: toSearchKey("Eksik Sayfa"),
        isSelectable: true,
        crestUrl: `${COMMONS}Eksik.svg`,
        crestLicense: "CC BY 4.0",
        crestAuthor: "Yazar",
        crestFilePage: null,
      },
      {
        // ARMASIZ kulüp listede hiç görünmemeli.
        id: "armasiz",
        wikidataId: "Q-armasiz",
        name: "Armasız",
        shortName: "Armasız",
        searchKey: toSearchKey("Armasız"),
        isSelectable: true,
        crestUrl: null,
      },
    ],
  });
}, 120_000);

afterAll(async () => {
  await db.destroy();
});

describe("listCrestCredits — BR-34", () => {
  it("yalnızca künyesi TAM olan armaları döner", async () => {
    const credits = await repository.listCrestCredits();

    expect(credits.map((c) => c.clubName)).toEqual(["Altay", "Bursaspor"]);
  });

  it("künyesi eksik arma listelenmez", async () => {
    const credits = await repository.listCrestCredits();

    // Eksik künyeli arma zaten gösterilmemeli; atıf listesinde göstermek
    // eksikliği görünmez kılardı.
    expect(credits.some((c) => c.clubName === "Eksik Sayfa")).toBe(false);
  });

  it("kamu malı armada yazar null kalır, lisans taşınır", async () => {
    const credits = await repository.listCrestCredits();
    const altay = credits.find((c) => c.clubName === "Altay");

    expect(altay?.author).toBeNull();
    expect(altay?.license).toBe("Public domain");
    expect(altay?.filePage).toContain("commons.wikimedia.org");
  });

  it("atıf gerektiren armada yazar taşınır", async () => {
    const credits = await repository.listCrestCredits();
    const bursa = credits.find((c) => c.clubName === "Bursaspor");

    expect(bursa?.author).toBe("Bir Yazar");
    expect(bursa?.license).toBe("CC BY-SA 4.0");
  });
});
