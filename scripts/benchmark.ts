import { STAT_KEYS } from "../src/domain/services/stat-match";
import { DEFAULT_SPELL_FILTER } from "../src/domain/services/spell-filter";
import { clubId } from "../src/domain/value-objects/identifiers";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaClubRepository } from "../src/infrastructure/db/repositories/prisma-club-repository";
import { PrismaPlayerRepository } from "../src/infrastructure/db/repositories/prisma-player-repository";
import { PrismaWhichMoreRepository } from "../src/infrastructure/db/repositories/prisma-which-more-repository";

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

/**
 * "Sen kur" ölçüt süzgecinin AYRI bütçesi (§9.1, BR-27).
 *
 * NEDEN 150 DEĞİL: §1.4'ün 150 ms'i ortak oyuncu sorgusu için ölçülüp
 * konmuştu. Süzgecin en kötü durumu (5×5, rastgele kulüpler) ölçüldüğünde
 * p95 134–148 ms çıkıyor — yani 150'lik bir kapı 2 ms payla geçerdi ve rutin
 * bir makine değişikliği onu düşürürdü. BR-22'nin tavanında aynı hata bir kez
 * yapıldı ve ölçülen değerin iki katına çekilerek düzeltildi; burada da aynı
 * ölçek kullanılıyor.
 *
 * Kullanıcının GERÇEKTE ödediği maliyet bu değil: kısıtlar değişmediği için
 * ilk çağrıdan sonrası önbellekten geliyor (aşağıda ayrıca ölçülüyor).
 */
const CRITERIA_BUDGET_MS = 250;

/**
 * "Hangisi daha" bütçeleri (§9.3).
 *
 * İKİYE AYRILDI çünkü iki maliyet farklı sınıflarda: havuz kurulumu süreç
 * başına BİR kez ödenir (BR-31), tur maliyeti HER turda. Tek bütçeye
 * sıkıştırmak, kullanıcının gerçekten beklediği süreyi (tur) soğuk maliyetin
 * altında gizlerdi.
 *
 * SOĞUK: ölçülen 280 ms, bütçe ölçülenin ~2 katı — BR-22'nin tavanında ve
 * §9.1'in ölçüt bütçesinde kullanılan ölçek.
 *
 * SICAK: ölçülen p95 0,7 ms. Burada "2 kat" kuralı işlemez — 1,4 ms'lik bir
 * kapı ölçüm gürültüsünün içinde kalır ve rastgele kırmızıya döner. Kapının
 * işi bu değil zaten: koruduğu şey, seçimin bir gün bellekten SQL'e geri
 * dönmesi. O regresyon 100 ms'in üstünde olurdu, yani 10 ms hem gürültünün
 * çok üstünde hem de yakaladığı hatanın bir mertebe altında.
 */
const WHICH_MORE_COLD_BUDGET_MS = 600;
const WHICH_MORE_BUDGET_MS = 10;

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
   * yazdıkça çağrılıyor. Ölçüt başına İKİ sayım sorgusu atılıyor (kulüp
   * adayları + uyruk adayları).
   *
   * EN KÖTÜ DURUM ÖLÇÜLÜR, ortalama değil: boyut 5×5'e çıkabildiği için
   * (BR-27) beş sütunlu bir çağrı ON sorgu demek. Bütçe kapısı ucuz olana
   * bakarsa, kullanıcının gerçekten ödediği maliyeti hiç görmez.
   */
  console.log('\n=== "Sen kur" ölçüt süzgeci (5 sütun — en kötü durum) ===');
  const criteriaTimes: number[] = [];
  for (let i = 0; i < 60; i++) {
    const against = [0, 1, 2, 3, 4].map((offset) => {
      const club = selectable[(i * 5 + offset) % selectable.length];
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
    `  soğuk: medyan ${percentile(criteriaTimes, 0.5).toFixed(1)} ms   ` +
      `p95 ${criteriaP95.toFixed(1)} ms   max ${(criteriaTimes.at(-1) ?? 0).toFixed(1)} ms`,
  );

  /*
   * SICAK YOL — kullanıcının yazarken ödediği maliyet.
   *
   * Seçici her tuş duraklamasında aynı kısıtlarla çağrılıyor; ölçüt başına
   * sayım önbellekte (§9.1). Soğuk sayı kapıyı belirler, kullanıcının
   * gördüğü sayı budur.
   */
  const warmAgainst = [0, 1, 2, 3, 4].map((offset) => {
    const club = selectable[offset % selectable.length];
    if (club === undefined) throw new Error("kulüp yok");
    return {
      type: "club" as const,
      clubId: clubId(club.id),
      label: club.shortName,
    };
  });
  await players.findPlayableCriteria({
    against: warmAgainst,
    term: null,
    limit: 20,
  });

  const warmTimes: number[] = [];
  for (let i = 0; i < 30; i++) {
    const started = performance.now();
    await players.findPlayableCriteria({
      against: warmAgainst,
      term: `a${String(i)}`,
      limit: 20,
    });
    warmTimes.push(performance.now() - started);
  }
  warmTimes.sort((a, b) => a - b);
  console.log(
    `  sıcak: medyan ${percentile(warmTimes, 0.5).toFixed(1)} ms   ` +
      `p95 ${percentile(warmTimes, 0.95).toFixed(1)} ms`,
  );

  /*
   * "Hangisi daha" turu (§9.3).
   *
   * İKİ AYRI MALİYET, ikisi de ölçülür:
   *
   *  · SOĞUK — tanınırlık havuzu süreç başına bir kez kuruluyor (BR-31) ve
   *    405 bin dönemi tarıyor. Sunucusuz bir ortamda bunu ilk isteği yapan
   *    kullanıcı öder, dolayısıyla "başlangıç maliyeti" diye kenara konamaz.
   *  · SICAK — her turda ödenen maliyet. Seçim bellekte ikili aramayla
   *    yapılıyor; kalan iş yalnızca iki oyuncunun tanıtım kulüplerini okumak.
   */
  console.log('\n=== "Hangisi daha" turu (§9.3) ===');
  const whichMore = new PrismaWhichMoreRepository(prisma);

  const coldStarted = performance.now();
  const firstPick = await whichMore.findCandidate({
    statKey: "appearances",
    threshold: null,
    side: "any",
    exclude: [],
  });
  const coldMs = performance.now() - coldStarted;
  console.log(
    `  soğuk (havuz kurulumu dâhil): ${coldMs.toFixed(1)} ms   ` +
      `(bütçe ${String(WHICH_MORE_COLD_BUDGET_MS)} ms)`,
  );

  if (firstPick === null) {
    throw new Error("Havuz boş — `npm run etl` çalıştırılmamış olabilir.");
  }

  const roundTimes: number[] = [];
  for (let i = 0; i < 120; i++) {
    const key = STAT_KEYS[i % STAT_KEYS.length];
    if (key === undefined) continue;

    const started = performance.now();
    const staying = await whichMore.findCandidate({
      statKey: key,
      threshold: null,
      side: "any",
      exclude: [],
    });
    if (staying !== null) {
      await whichMore.findCandidate({
        statKey: key,
        threshold: staying.value,
        side: i % 2 === 0 ? "above" : "below",
        exclude: [],
      });
    }
    roundTimes.push(performance.now() - started);
  }
  roundTimes.sort((a, b) => a - b);
  const roundP95 = percentile(roundTimes, 0.95);
  console.log(
    `  sıcak (tur başına): medyan ${percentile(roundTimes, 0.5).toFixed(1)} ms   ` +
      `p95 ${roundP95.toFixed(1)} ms   (bütçe ${String(WHICH_MORE_BUDGET_MS)} ms)`,
  );

  await prisma.$disconnect();

  if (coldMs > WHICH_MORE_COLD_BUDGET_MS) {
    console.log(
      `\nBÜTÇE AŞILDI: "Hangisi daha" havuz kurulumu ${coldMs.toFixed(1)} ms > ` +
        `${String(WHICH_MORE_COLD_BUDGET_MS)} ms (§9.3)`,
    );
    process.exitCode = 1;
    return;
  }

  if (roundP95 > WHICH_MORE_BUDGET_MS) {
    console.log(
      `\nBÜTÇE AŞILDI: "Hangisi daha" turu p95 ${roundP95.toFixed(1)} ms > ` +
        `${String(WHICH_MORE_BUDGET_MS)} ms (§9.3)`,
    );
    process.exitCode = 1;
    return;
  }

  if (criteriaP95 > CRITERIA_BUDGET_MS) {
    console.log(
      `\nBÜTÇE AŞILDI: ölçüt süzgeci p95 ${criteriaP95.toFixed(1)} ms > ` +
        `${String(CRITERIA_BUDGET_MS)} ms (§9.1)`,
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
