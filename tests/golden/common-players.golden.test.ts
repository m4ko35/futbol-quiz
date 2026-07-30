import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findCommonPlayers } from "@/application/use-cases/find-common-players";
import { PrismaClient } from "@/generated/prisma";
import { PrismaClubRepository } from "@/infrastructure/db/repositories/prisma-club-repository";
import { PrismaPlayerRepository } from "@/infrastructure/db/repositories/prisma-player-repository";
import { clubId, type ClubId } from "@/domain/value-objects/identifiers";
import {
  COUNT_TOLERANCE,
  FROZEN_COUNTS,
  GOLDEN_FACTS,
} from "../fixtures/golden-pairs";

/**
 * Doğruluk testleri — PROJECT.md §8.1, §1.4.
 *
 * Diğer testlerden farkı: bunlar GERÇEK veri kümesine bakar. Birim testleri
 * kuralların doğru yazıldığını, entegrasyon testleri sorgunun doğru
 * çevrildiğini söyler; hiçbiri "sonuç gerçekten doğru mu" sorusunu
 * cevaplamaz. Bu dosya onu sorar.
 *
 * Veritabanı yoksa ATLANIR: ETL çıktısı depoya girmez, dolayısıyla temiz bir
 * makinede ya da CI'da bu dosya çalışamaz. Sessizce geçmek yerine açıkça
 * atlanır — "çalıştı" ile "çalışmadı ama ses çıkarmadı" karıştırılmamalı.
 */

const DB_PATH = path.join(process.cwd(), "prisma", "dev.db");
const hasDatabase = existsSync(DB_PATH);

let prisma: PrismaClient;
let deps: {
  clubs: PrismaClubRepository;
  players: PrismaPlayerRepository;
};
/** Wikidata QID → veritabanı kimliği. */
let clubIdByQid: Map<string, ClubId>;
let playerQidById: Map<string, string>;

describe.skipIf(!hasDatabase)("altın veri seti — doğruluk", () => {
  beforeAll(async () => {
    prisma = new PrismaClient({
      datasourceUrl: `file:${DB_PATH.replaceAll("\\", "/")}`,
    });
    deps = {
      clubs: new PrismaClubRepository(prisma),
      players: new PrismaPlayerRepository(prisma),
    };

    const clubs = await prisma.club.findMany({
      select: { id: true, wikidataId: true },
    });
    clubIdByQid = new Map(clubs.map((c) => [c.wikidataId, clubId(c.id)]));

    const players = await prisma.player.findMany({
      select: { id: true, wikidataId: true },
    });
    playerQidById = new Map(players.map((p) => [p.id, p.wikidataId]));
  }, 60_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("altın setteki tüm kulüpler veri kümesinde ve seçilebilir", async () => {
    const qids = new Set(GOLDEN_FACTS.flatMap((f) => [f.a, f.b]));
    const rows = await prisma.club.findMany({
      where: { wikidataId: { in: [...qids] } },
      select: { wikidataId: true, isSelectable: true, shortName: true },
    });

    const missing = [...qids].filter(
      (qid) => !rows.some((r) => r.wikidataId === qid && r.isSelectable),
    );

    expect(missing).toEqual([]);
  });

  it.each(GOLDEN_FACTS)(
    "$name → $a ∩ $b sonucunda bulunur",
    async ({ a, b, player }) => {
      const clubA = clubIdByQid.get(a);
      const clubB = clubIdByQid.get(b);
      expect(clubA, `kulüp ${a} yok`).toBeDefined();
      expect(clubB, `kulüp ${b} yok`).toBeDefined();

      const result = await findCommonPlayers(
        { clubA: clubA as ClubId, clubB: clubB as ClubId },
        deps,
      );

      const foundQids = result.players.map((p) => playerQidById.get(p.id));
      expect(foundQids).toContain(player);
    },
  );

  it.each(FROZEN_COUNTS)(
    "$label sayımı dondurulmuş değere yakın kalır",
    async ({ a, b, count }) => {
      const result = await findCommonPlayers(
        {
          clubA: clubIdByQid.get(a) as ClubId,
          clubB: clubIdByQid.get(b) as ClubId,
        },
        deps,
      );

      const tolerance = Math.ceil(count * COUNT_TOLERANCE);
      expect(result.count).toBeGreaterThanOrEqual(count - tolerance);
      expect(result.count).toBeLessThanOrEqual(count + tolerance);
    },
  );

  it("sonuç, kulüp sırasından bağımsızdır", async () => {
    for (const { a, b } of FROZEN_COUNTS) {
      const clubA = clubIdByQid.get(a) as ClubId;
      const clubB = clubIdByQid.get(b) as ClubId;

      const forward = await findCommonPlayers({ clubA, clubB }, deps);
      const reversed = await findCommonPlayers(
        { clubA: clubB, clubB: clubA },
        deps,
      );

      expect(reversed.count).toBe(forward.count);
      expect(new Set(reversed.players.map((p) => p.id))).toEqual(
        new Set(forward.players.map((p) => p.id)),
      );
    }
  });

  it("dönen her oyuncunun İKİ kulüpte de dönemi vardır (BR-1)", async () => {
    for (const { a, b } of FROZEN_COUNTS) {
      const result = await findCommonPlayers(
        {
          clubA: clubIdByQid.get(a) as ClubId,
          clubB: clubIdByQid.get(b) as ClubId,
        },
        deps,
      );

      for (const player of result.players) {
        expect(player.spellsAtA.length).toBeGreaterThan(0);
        expect(player.spellsAtB.length).toBeGreaterThan(0);
      }
    }
  });

  it("sıralama BR-5'e uyar: maç sayısı bilinenler önde ve azalan", async () => {
    const result = await findCommonPlayers(
      {
        clubA: clubIdByQid.get(FROZEN_COUNTS[0]?.a ?? "") as ClubId,
        clubB: clubIdByQid.get(FROZEN_COUNTS[0]?.b ?? "") as ClubId,
      },
      deps,
    );

    const totals = result.players.map((p) =>
      sumKnown([...p.spellsAtA, ...p.spellsAtB].map((s) => s.appearances)),
    );

    const known = totals.filter((t): t is number => t !== null);
    const firstUnknown = totals.indexOf(null);

    // Bilinenler bloğu başta olmalı.
    if (firstUnknown !== -1) {
      expect(totals.slice(firstUnknown).every((t) => t === null)).toBe(true);
    }
    // Ve kendi içinde azalan olmalı.
    expect([...known].sort((x, y) => y - x)).toEqual(known);
  });

  it("varsayılan ölçüt altyapı dönemi döndürmez (BR-2)", async () => {
    const result = await findCommonPlayers(
      {
        clubA: clubIdByQid.get("Q495299") as ClubId,
        clubB: clubIdByQid.get("Q6601875") as ClubId,
      },
      deps,
    );

    const playerIds = result.players.map((p) => p.id);
    const youthSpells = await prisma.spell.count({
      where: { playerId: { in: playerIds }, isYouth: true },
    });

    // Veri kümesinde altyapı takımı yok (§10.2); bu denetim, ileride alt lig
    // kapsamı eklendiğinde kuralın hâlâ uygulandığını garanti eder.
    expect(youthSpells).toBe(0);
  });

  it("altyapıyı dahil etmek sonucu DARALTAMAZ", async () => {
    const clubA = clubIdByQid.get("Q495299") as ClubId;
    const clubB = clubIdByQid.get("Q6601875") as ClubId;

    const strict = await findCommonPlayers({ clubA, clubB }, deps);
    const relaxed = await findCommonPlayers(
      { clubA, clubB, filter: { includeYouth: true } },
      deps,
    );

    expect(relaxed.count).toBeGreaterThanOrEqual(strict.count);
    const relaxedIds = new Set(relaxed.players.map((p) => p.id));
    for (const player of strict.players) {
      expect(relaxedIds).toContain(player.id);
    }
  });

  it("kiralıkları çıkarmak sonucu GENİŞLETEMEZ (BR-3)", async () => {
    const clubA = clubIdByQid.get("Q495299") as ClubId;
    const clubB = clubIdByQid.get("Q6601875") as ClubId;

    const withLoans = await findCommonPlayers({ clubA, clubB }, deps);
    const withoutLoans = await findCommonPlayers(
      { clubA, clubB, filter: { includeLoans: false } },
      deps,
    );

    expect(withoutLoans.count).toBeLessThanOrEqual(withLoans.count);
  });

  /**
   * Bilinen veri kalitesi sınırı — §1.4'ün "yanlış pozitif yok" ölçütü şu an
   * KARŞILANMIYOR ve bu test onu görünür tutar.
   *
   * Wikidata'da tarihsiz ve maçsız `P54` kayıtları var; bunların bir kısmı
   * altyapı/deneme dönemleridir ama ana kulüp varlığına bağlandıkları için
   * `isYouth` ile ayıklanamıyor. Örnek: Chedric Seedorf (Q1650766), Real
   * Madrid ve Inter'de tarihsiz ve maçsız kayıtlarla görünüyor.
   *
   * Test bu oranı DONDURMAZ, sadece büyümesini engeller. Amaç sorunu çözmüş
   * gibi yapmak değil; ölçülü tutmak ve sessizce kötüleşmesini önlemek.
   */
  it("tarihsiz dönem oranı ölçülü kalır (bilinen sınır)", async () => {
    const total = await prisma.spell.count();
    const dateless = await prisma.spell.count({
      where: { startYear: null, endYear: null },
    });

    const ratio = dateless / total;
    expect(ratio).toBeLessThan(0.15);
  });
});

function sumKnown(values: readonly (number | null)[]): number | null {
  let total = 0;
  let known = false;
  for (const value of values) {
    if (value === null) continue;
    total += value;
    known = true;
  }
  return known ? total : null;
}
