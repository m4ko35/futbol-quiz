import { DEFAULT_SPELL_FILTER } from "../src/domain/services/spell-filter";
import { clubId } from "../src/domain/value-objects/identifiers";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaClubRepository } from "../src/infrastructure/db/repositories/prisma-club-repository";
import { PrismaPlayerRepository } from "../src/infrastructure/db/repositories/prisma-player-repository";

/**
 * Sorgu performansı ölçümü — `npm run bench` (PROJECT.md §1.4).
 *
 * NEDEN KALICI BİR BETİK: §1.4 "p95 < 150 ms" diyor. Bir hedef, ancak
 * tekrarlanabilir biçimde ölçülebiliyorsa hedeftir; aksi hâlde temennidir.
 * Bu betik `db:verify` ile aynı rolü oynar — biri doğruluğu, diğeri hızı
 * denetler ve ikisi de hatalı çıkışla biter.
 *
 * ÖLÇÜLEN ŞEY repository KOD YOLUDUR, elle yazılmış bir sorgu kopyası değil.
 * Kopyayı ölçmek, uygulamanın gerçekte ne yaptığı hakkında hiçbir şey
 * söylemez.
 */

/** §1.4 hedefi. Aşılırsa betik hata ile biter. */
const P95_BUDGET_MS = 150;

/** Ölçüm sayısı: p95'in oturması için yeterli, koşu süresi için makul. */
const SAMPLES = 300;

const prisma = new PrismaClient();

function percentile(sorted: readonly number[], fraction: number): number {
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ??
    0
  );
}

async function main(): Promise<void> {
  const players = new PrismaPlayerRepository(prisma);
  const clubs = new PrismaClubRepository(prisma);

  const selectable = await prisma.club.findMany({
    where: { isSelectable: true },
    select: { id: true, shortName: true },
  });

  if (selectable.length < 2) {
    throw new Error(
      "Ölçüm için yeterli kulüp yok. Önce `npm run etl` çalıştırın.",
    );
  }

  const findCommon = (a: string, b: string) =>
    players.findCommonPlayers({
      clubA: clubId(a),
      clubB: clubId(b),
      filter: DEFAULT_SPELL_FILTER,
    });

  // Isınma: ilk çağrılar bağlantı kurulumu ve sorgu derlemesi maliyeti taşır;
  // ölçüme katılırlarsa p95'i gerçekte olmadığı kadar kötü gösterirler.
  for (let i = 0; i < 20; i++) {
    const x = selectable[i % selectable.length];
    const y = selectable[(i + 7) % selectable.length];
    if (x && y && x.id !== y.id) await findCommon(x.id, y.id);
  }

  const times: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const x = selectable[Math.floor(Math.random() * selectable.length)];
    const y = selectable[Math.floor(Math.random() * selectable.length)];
    if (!x || !y || x.id === y.id) continue;

    const started = performance.now();
    await findCommon(x.id, y.id);
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);

  const p50 = percentile(times, 0.5);
  const p95 = percentile(times, 0.95);
  const p99 = percentile(times, 0.99);

  console.log(`=== Ortak oyuncu sorgusu (${times.length} rastgele çift) ===`);
  console.log(`  p50 ${p50.toFixed(1)} ms`);
  console.log(`  p95 ${p95.toFixed(1)} ms   (bütçe ${P95_BUDGET_MS} ms)`);
  console.log(`  p99 ${p99.toFixed(1)} ms`);
  console.log(`  max ${(times.at(-1) ?? 0).toFixed(1)} ms`);

  // En kalabalık kesişimler: rastgele örneklem bunları ıskalayabilir, oysa
  // en kötü durumu tam olarak onlar temsil eder.
  console.log("\n=== Bilinen ağır çiftler ===");
  for (const [qidA, qidB, label] of [
    ["Q1543", "Q631", "Milan ∩ Inter"],
    ["Q18656", "Q50602", "Man Utd ∩ Man City"],
    ["Q7156", "Q8682", "Barcelona ∩ Real Madrid"],
    ["Q495299", "Q6601875", "Galatasaray ∩ Fenerbahçe"],
  ] as const) {
    const [a, b] = await Promise.all([
      prisma.club.findUnique({ where: { wikidataId: qidA } }),
      prisma.club.findUnique({ where: { wikidataId: qidB } }),
    ]);
    if (a === null || b === null) {
      console.log(`  ⚠ ${label}: kulüp bulunamadı, atlandı`);
      continue;
    }

    const started = performance.now();
    const result = await findCommon(a.id, b.id);
    console.log(
      `  ${label.padEnd(26)} ${String(result.length).padStart(4)} oyuncu  ` +
        `${(performance.now() - started).toFixed(1)} ms`,
    );
  }

  console.log("\n=== Kulüp arama ===");
  const searchTimes: number[] = [];
  for (const term of [
    "gal",
    "beş",
    "real",
    "man",
    "bar",
    "liv",
    "juv",
    "bay",
  ]) {
    const started = performance.now();
    await clubs.search({ term, limit: 20 });
    searchTimes.push(performance.now() - started);
  }
  searchTimes.sort((a, b) => a - b);
  console.log(
    `  medyan ${percentile(searchTimes, 0.5).toFixed(1)} ms   ` +
      `max ${(searchTimes.at(-1) ?? 0).toFixed(1)} ms`,
  );

  /*
   * "Sen kur" ölçüt süzgeci (§9.1, BR-25).
   *
   * BÜTÇEYE DÂHİL çünkü etkileşimli bir yolda: kullanıcı satır seçerken
   * yazdıkça çağrılıyor. Ölçüt başına bir sayım sorgusu atılıyor, yani üç
   * sütunlu bir çağrı altı sorgu demek — maliyeti görünür tutmak gerekiyor.
   */
  console.log('\n=== "Sen kur" ölçüt süzgeci (3 sütun) ===');
  const criteriaTimes: number[] = [];
  for (let i = 0; i < 60; i++) {
    const against = [0, 1, 2].map((offset) => {
      const club = selectable[(i * 3 + offset) % selectable.length];
      if (club === undefined) throw new Error("kulüp yok");
      return {
        type: "club" as const,
        clubId: clubId(club.id),
        label: club.shortName,
      };
    });

    const started = performance.now();
    await players.findPlayableCriteria({ against, term: null, limit: 20 });
    criteriaTimes.push(performance.now() - started);
  }
  criteriaTimes.sort((a, b) => a - b);
  const criteriaP95 = percentile(criteriaTimes, 0.95);
  console.log(
    `  medyan ${percentile(criteriaTimes, 0.5).toFixed(1)} ms   ` +
      `p95 ${criteriaP95.toFixed(1)} ms   max ${(criteriaTimes.at(-1) ?? 0).toFixed(1)} ms`,
  );

  await prisma.$disconnect();

  if (criteriaP95 > P95_BUDGET_MS) {
    console.log(
      `\nBÜTÇE AŞILDI: ölçüt süzgeci p95 ${criteriaP95.toFixed(1)} ms > ` +
        `${String(P95_BUDGET_MS)} ms (§1.4)`,
    );
    process.exitCode = 1;
    return;
  }

  if (p95 > P95_BUDGET_MS) {
    console.log(
      `\nBÜTÇE AŞILDI: p95 ${p95.toFixed(1)} ms > ${P95_BUDGET_MS} ms (§1.4)`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`\nBÜTÇE İÇİNDE (p95 ${p95.toFixed(1)} ms)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
