import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClubRepository } from "@/infrastructure/db/repositories/prisma-club-repository";
import { PrismaPlayerRepository } from "@/infrastructure/db/repositories/prisma-player-repository";
import type { Spell } from "@/domain/entities/spell";
import {
  spellQualifies,
  type SpellFilter,
} from "@/domain/services/spell-filter";
import { clubId } from "@/domain/value-objects/identifiers";
import { toSearchKey } from "@/domain/value-objects/search-key";
import {
  createTestDatabase,
  type TestDatabase,
} from "../helpers/test-database";

/**
 * Port sözleşmesinin GERÇEK veritabanında da geçerli olduğunu ölçer (§8.1).
 *
 * Birim testleri sahte repository ile çalışır ve iş kurallarını doğrular;
 * onlar Prisma sorgusunun doğru yazıldığını söyleyemez. Buradaki testler tam
 * olarak o boşluğu kapatır.
 */

let db: TestDatabase;
let clubs: PrismaClubRepository;
let players: PrismaPlayerRepository;

const CLUB_A = "clubGalatasaray";
const CLUB_B = "clubArsenal";
const CLUB_C = "clubBesiktas";

/**
 * Tohum veri: dört bayrak birleşimini de kapsar.
 *
 * Amaç gerçekçi bir kadro kurmak değil, ölçütün DÖRT durumunu da bir kez
 * yaşatmak: normal, kiralık, altyapı, hem kiralık hem altyapı.
 */
const SEED_PLAYERS = [
  { id: "pNormal", name: "Normal Oyuncu", a: {}, b: {} },
  { id: "pLoanA", name: "Kiralık Oyuncu", a: { isLoan: true }, b: {} },
  { id: "pYouthA", name: "Altyapı Oyuncu", a: { isYouth: true }, b: {} },
  {
    id: "pBoth",
    name: "Kiralık Altyapı",
    a: { isLoan: true, isYouth: true },
    b: {},
  },
  {
    id: "pLoanBoth",
    name: "Çift Kiralık",
    a: { isLoan: true },
    b: { isLoan: true },
  },
] as const;

beforeAll(async () => {
  db = createTestDatabase();
  clubs = new PrismaClubRepository(db.prisma);
  players = new PrismaPlayerRepository(db.prisma);

  await db.prisma.league.create({
    data: {
      id: "lg1",
      wikidataId: "Q485568",
      name: "Süper Lig",
      country: "TR",
    },
  });

  await db.prisma.club.createMany({
    data: [
      {
        id: CLUB_A,
        wikidataId: "Q495299",
        name: "Galatasaray Spor Kulübü",
        shortName: "Galatasaray",
        searchKey: toSearchKey("Galatasaray Spor Kulübü"),
        country: "TR",
        isSelectable: true,
        leagueId: "lg1",
      },
      {
        id: CLUB_B,
        wikidataId: "Q9617",
        name: "Arsenal F.C.",
        shortName: "Arsenal",
        searchKey: toSearchKey("Arsenal F.C."),
        country: "GB",
        isSelectable: true,
      },
      {
        id: CLUB_C,
        wikidataId: "Q104329",
        name: "Beşiktaş JK",
        shortName: "Beşiktaş",
        searchKey: toSearchKey("Beşiktaş JK"),
        country: "TR",
        isSelectable: true,
      },
      {
        id: "clubEski",
        wikidataId: "Q1234567",
        name: "Olympique Lillois",
        shortName: "Lillois",
        searchKey: toSearchKey("Olympique Lillois"),
        country: "FR",
        // Seçilemez: arama sonuçlarında ASLA görünmemeli (§5.3).
        isSelectable: false,
      },
    ],
  });

  for (const seed of SEED_PLAYERS) {
    await db.prisma.player.create({
      data: {
        id: seed.id,
        wikidataId: `WD-${seed.id}`,
        name: seed.name,
        searchKey: toSearchKey(seed.name),
        nationality: "TR",
        position: "Orta saha",
        spells: {
          create: [
            {
              wikidataStatementId: `${seed.id}-A`,
              clubId: CLUB_A,
              startYear: 2010,
              endYear: 2012,
              appearances: 50,
              goals: 5,
              ...seed.a,
            },
            {
              wikidataStatementId: `${seed.id}-B`,
              clubId: CLUB_B,
              startYear: 2013,
              endYear: 2015,
              appearances: 30,
              goals: 2,
              ...seed.b,
            },
          ],
        },
      },
    });
  }

  // Yalnızca A'da oynamış oyuncu — ortak sayılmamalı (BR-1).
  await db.prisma.player.create({
    data: {
      id: "pSadeceA",
      wikidataId: "WD-pSadeceA",
      name: "Sadece A",
      searchKey: toSearchKey("Sadece A"),
      spells: {
        create: [
          {
            wikidataStatementId: "pSadeceA-A",
            clubId: CLUB_A,
            startYear: 2011,
          },
        ],
      },
    },
  });

  // Üç kulüpte de oynamış oyuncu — C'deki dönemi sonuca sızmamalı.
  await db.prisma.player.create({
    data: {
      id: "pUcKulup",
      wikidataId: "WD-pUcKulup",
      name: "Üç Kulüp",
      searchKey: toSearchKey("Üç Kulüp"),
      spells: {
        create: [
          {
            wikidataStatementId: "pUcKulup-A",
            clubId: CLUB_A,
            startYear: 2005,
          },
          {
            wikidataStatementId: "pUcKulup-B",
            clubId: CLUB_B,
            startYear: 2007,
          },
          {
            wikidataStatementId: "pUcKulup-C",
            clubId: CLUB_C,
            startYear: 2009,
          },
        ],
      },
    },
  });
}, 60_000);

afterAll(async () => {
  await db.destroy();
});

const ALL_FILTERS: readonly SpellFilter[] = [
  { includeYouth: false, includeLoans: true },
  { includeYouth: false, includeLoans: false },
  { includeYouth: true, includeLoans: true },
  { includeYouth: true, includeLoans: false },
];

describe("PrismaPlayerRepository — port sözleşmesi", () => {
  it("1. madde: dönen her oyuncunun iki kulüpte de dönemi vardır", async () => {
    const result = await players.findCommonPlayers({
      clubA: clubId(CLUB_A),
      clubB: clubId(CLUB_B),
      filter: { includeYouth: true, includeLoans: true },
    });

    expect(result.length).toBeGreaterThan(0);
    for (const entry of result) {
      expect(entry.spells.some((s) => s.clubId === CLUB_A)).toBe(true);
      expect(entry.spells.some((s) => s.clubId === CLUB_B)).toBe(true);
    }
    expect(result.map((r) => r.player.id)).not.toContain("pSadeceA");
  });

  it("2. madde: yalnızca iki kulübün dönemleri döner", async () => {
    const result = await players.findCommonPlayers({
      clubA: clubId(CLUB_A),
      clubB: clubId(CLUB_B),
      filter: { includeYouth: true, includeLoans: true },
    });

    const threeClubPlayer = result.find((r) => r.player.id === "pUcKulup");
    expect(threeClubPlayer).toBeDefined();
    expect(threeClubPlayer?.spells).toHaveLength(2);
    expect(
      threeClubPlayer?.spells.every(
        (s) => s.clubId === CLUB_A || s.clubId === CLUB_B,
      ),
    ).toBe(true);
  });

  it("4. madde: aynı oyuncu birden çok kez dönmez", async () => {
    const result = await players.findCommonPlayers({
      clubA: clubId(CLUB_A),
      clubB: clubId(CLUB_B),
      filter: { includeYouth: true, includeLoans: true },
    });

    const ids = result.map((r) => r.player.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * 3. madde ve bu dosyanın asıl varlık sebebi.
   *
   * `spellQualifies` bir kez TypeScript'te, bir kez SQL WHERE olarak yazılı.
   * Bu test ikisini karşılaştırır: veritabanından FİLTRESİZ çekilen satırlara
   * domain yüklemini bellekte uygular ve sonucun repository'ninkiyle birebir
   * aynı olmasını bekler. Çeviri bozulursa burada görünür.
   */
  it.each(ALL_FILTERS)(
    "3. madde: SQL çevirisi domain yüklemiyle aynı sonucu verir (%o)",
    async (filter) => {
      const fromRepository = await players.findCommonPlayers({
        clubA: clubId(CLUB_A),
        clubB: clubId(CLUB_B),
        filter,
      });

      const expected = await computeExpectedInMemory(filter);

      expect(summarize(fromRepository)).toEqual(expected);
    },
  );

  it("kulüpler yer değiştirdiğinde aynı oyuncu kümesi döner", async () => {
    const filter: SpellFilter = { includeYouth: false, includeLoans: true };

    const forward = await players.findCommonPlayers({
      clubA: clubId(CLUB_A),
      clubB: clubId(CLUB_B),
      filter,
    });
    const reversed = await players.findCommonPlayers({
      clubA: clubId(CLUB_B),
      clubB: clubId(CLUB_A),
      filter,
    });

    expect(reversed.map((r) => r.player.id).sort()).toEqual(
      forward.map((r) => r.player.id).sort(),
    );
  });

  it("ortak oyuncusu olmayan çift için boş liste döner", async () => {
    const result = await players.findCommonPlayers({
      clubA: clubId(CLUB_B),
      clubB: clubId(CLUB_C),
      filter: { includeYouth: true, includeLoans: true },
    });

    // Yalnızca "Üç Kulüp" hem B hem C'de oynadı.
    expect(result.map((r) => r.player.id)).toEqual(["pUcKulup"]);
  });

  it("null alanlar 0'a çevrilmeden taşınır", async () => {
    const result = await players.findCommonPlayers({
      clubA: clubId(CLUB_A),
      clubB: clubId(CLUB_B),
      filter: { includeYouth: true, includeLoans: true },
    });

    const spells = result.find((r) => r.player.id === "pUcKulup")?.spells ?? [];
    expect(spells[0]?.appearances).toBeNull();
    expect(spells[0]?.years.end).toBeNull();
  });
});

describe("PrismaClubRepository", () => {
  it("yalnızca seçilebilir kulüpleri döndürür", async () => {
    const result = await clubs.search({
      term: null,
      limit: 50,
      leagueWikidataId: null,
    });

    expect(result.map((c) => c.shortName)).not.toContain("Lillois");
  });

  it("seçilemez kulüp aranarak da bulunamaz", async () => {
    const result = await clubs.search({
      term: "Lillois",
      limit: 50,
      leagueWikidataId: null,
    });

    expect(result).toEqual([]);
  });

  it("Türkçe karakterli aramayı aksansız anahtar üzerinden çözer", async () => {
    // Veritabanındaki anahtar "besiktas jk"; kullanıcı "Beşiktaş" yazıyor.
    // Normalizasyon iki tarafta da aynı olmasa bu arama boş dönerdi.
    const result = await clubs.search({
      term: "Beşiktaş",
      limit: 10,
      leagueWikidataId: null,
    });

    expect(result.map((c) => c.shortName)).toEqual(["Beşiktaş"]);
  });

  it("aksansız yazımla da bulur", async () => {
    const result = await clubs.search({
      term: "besiktas",
      limit: 10,
      leagueWikidataId: null,
    });

    expect(result.map((c) => c.shortName)).toEqual(["Beşiktaş"]);
  });

  it("limit'e uyar", async () => {
    const result = await clubs.search({
      term: null,
      limit: 2,
      leagueWikidataId: null,
    });

    expect(result).toHaveLength(2);
  });

  it("findByIds bulunamayanlar için hata FIRLATMAZ", async () => {
    const result = await clubs.findByIds([clubId(CLUB_A), clubId("yokBoyle")]);

    expect(result.map((c) => c.id)).toEqual([CLUB_A]);
  });

  it("findByIds boş girdi için veritabanına gitmeden boş döner", async () => {
    expect(await clubs.findByIds([])).toEqual([]);
  });

  // ── BR-37: lig süzgeci ve gözatma ────────────────────────────────────
  //
  // Sözleşmenin GERÇEK veritabanında da geçerli olduğu burada ölçülür;
  // fake ile birim testi aynı kuralı bellek içinde denetliyor.

  it("lig süzgeci yalnızca o ligin kulüplerini döndürür", async () => {
    const result = await clubs.search({
      term: null,
      limit: 50,
      leagueWikidataId: "Q485568",
    });

    // Tohumda yalnızca Galatasaray Süper Lig'e bağlı; Arsenal ve Beşiktaş
    // ligsiz. Süzgeç onları ELEMELİ.
    expect(result.map((c) => c.shortName)).toEqual(["Galatasaray"]);
  });

  it("lig süzgeci ad aramasıyla BİRLİKTE çalışır", async () => {
    const result = await clubs.search({
      term: "besiktas",
      limit: 50,
      leagueWikidataId: "Q485568",
    });

    // Beşiktaş ada uyuyor ama o ligde değil: iki koşul VE ile birleşmeli.
    expect(result).toEqual([]);
  });

  it("tanınmayan lig QID'i hata değil, BOŞ sonuçtur", async () => {
    // Port sözleşmesi (`findByIds` ile aynı): geçerli kimlik denetimi
    // port'un işi değil. Hata fırlatmak, sınırdaki Zod doğrulamasıyla
    // ikinci bir kural yeri açardı.
    const result = await clubs.search({
      term: null,
      limit: 50,
      leagueWikidataId: "Q999999999",
    });

    expect(result).toEqual([]);
  });

  it("listLeagues seçilebilir kulüp sayısını verir", async () => {
    const result = await clubs.listLeagues();

    expect(result).toEqual([
      {
        wikidataId: "Q485568",
        name: "Süper Lig",
        country: "TR",
        clubCount: 1,
      },
    ]);
  });

  it("seçilebilir kulübü OLMAYAN lig listelenmez", async () => {
    // Tıklandığında boş liste veren bir satır, kullanıcıya veri kusuru gibi
    // görünür. Ligin kulübü var ama seçilemez — yine de gösterilmemeli.
    await db.prisma.league.create({
      data: {
        id: "lgBos",
        wikidataId: "Q7654321",
        name: "Boş Lig",
        country: "FR",
      },
    });
    await db.prisma.club.update({
      where: { id: "clubEski" },
      data: { leagueId: "lgBos" },
    });

    const result = await clubs.listLeagues();

    expect(result.map((l) => l.wikidataId)).not.toContain("Q7654321");
  });
});

/** Repository'nin döndürmesi GEREKEN sonucu domain kurallarıyla hesaplar. */
async function computeExpectedInMemory(
  filter: SpellFilter,
): Promise<{ playerId: string; spellCount: number }[]> {
  const rows = await db.prisma.player.findMany({
    include: { spells: true },
    orderBy: { id: "asc" },
  });

  const expected: { playerId: string; spellCount: number }[] = [];

  for (const row of rows) {
    const spells = row.spells
      .filter((s) => s.clubId === CLUB_A || s.clubId === CLUB_B)
      .filter((s) => spellQualifies(s, filter));

    const atA = spells.some((s) => s.clubId === CLUB_A);
    const atB = spells.some((s) => s.clubId === CLUB_B);
    if (!atA || !atB) continue;

    expected.push({ playerId: row.id, spellCount: spells.length });
  }

  return expected;
}

function summarize(
  entries: readonly { player: { id: string }; spells: readonly Spell[] }[],
): { playerId: string; spellCount: number }[] {
  return entries
    .map((entry) => ({
      playerId: entry.player.id,
      spellCount: entry.spells.length,
    }))
    .sort((a, b) => a.playerId.localeCompare(b.playerId));
}
