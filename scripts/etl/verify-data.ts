import { PrismaClient } from "../../src/generated/prisma";
import { MIN_SPELLS_FOR_SELECTABLE } from "./leagues";

/**
 * Yüklenen veri kümesinin kabul kontrolü — `npm run db:verify`.
 *
 * NEDEN BİRİM TESTİ DEĞİL: burada denetlenen şey kod değil, ETL'in ürettiği
 * **veri artefaktı**. CI'da böyle bir veritabanı yoktur; kontrol çekimden
 * sonra, veriye karşı çalıştırılır ve hatalı çıkışla biter.
 *
 * NEDEN VAR: Faz 1 boyunca doğrulama "birkaç kulübe bakıp iyi görünüyor"
 * demekten ibaretti ve üç ayrı gerilemeyi kaçırdı (Augsburg 0 dönemle girdi,
 * sonra Barcelona ve Antalyaspor kabuk varlığa taşındı — §5.3). Bu betiğin
 * ilk sürümü sonuncusunu ilk koşuda yakaladı. Kulüp evreni sorgularına her
 * dokunuşta yeniden çalıştırılır.
 */

const prisma = new PrismaClient();

/**
 * Seçilebilir olması ZORUNLU kulüpler — **QID ile** sabitlenmiş.
 *
 * Neden ada göre değil QID'e göre: bozulan şey tam olarak "hangi varlık"
 * sorusuydu. Wikidata'da aynı adı taşıyan birden çok kayıt var ve yanlış olan
 * da doğru adı taşıyor (`Q3091261` de "FC Barcelona" diyor, ama 22 oyuncusu
 * var). Ada bakan bir kontrol bu hataların hiçbirini göremezdi.
 *
 * Liste keyfi değil: her satır bir kez bozulmuş bir kulüptür. Yeni bir
 * kulüp-eşleme hatası düzeltildiğinde buraya eklenir, böylece aynı hata
 * ikinci kez sessizce geri gelemez.
 */
const MUST_BE_SELECTABLE: readonly { qid: string; why: string }[] = [
  { qid: "Q101859", why: "Wolfsburg — P118'de yok, sezon katılımcısı" },
  { qid: "Q6463", why: "St. Pauli — P118'de yok, sezon katılımcısı" },
  { qid: "Q162251", why: "Heidenheim — P118'de yok, sezon katılımcısı" },
  { qid: "Q15755", why: "Augsburg — sezon varlığı; gerçek kulüp P831 ucunda" },
  { qid: "Q7156", why: "Barcelona — P831 çözümlemesi kabuğa taşımıştı" },
  { qid: "Q43710", why: "Antalyaspor — P831 çözümlemesi ana kulübe taşımıştı" },
  { qid: "Q15789", why: "Bayern — tek sınıflı tür kısıtında düşüyordu" },
  { qid: "Q495299", why: "Galatasaray — Süper Lig kapsamı" },
  { qid: "Q6601875", why: "Fenerbahçe — Süper Lig kapsamı" },
  { qid: "Q192641", why: "Trabzonspor — Süper Lig kapsamı" },
];

/** MVP'nin çekirdek sorusu boş dönmemesi gereken çiftler. */
const KNOWN_PAIRS: readonly [string, string][] = [
  ["galatasaray", "arsenal"],
  ["real madrid", "manchester united"],
  ["barcelona", "bayern"],
  ["liverpool", "everton"],
  ["fenerbahce", "besiktas"],
];

/**
 * Eşik ETL ile tek kaynaktan okunur; burada yeniden yazılırsa iki değer
 * sessizce birbirinden ayrılır ve kontrol yanlış şeyi doğrulamaya başlar.
 */
const MIN_SPELLS = MIN_SPELLS_FOR_SELECTABLE;

const failures: string[] = [];

function check(ok: boolean, message: string): void {
  console.log(`  ${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failures.push(message);
}

async function reportCounts(): Promise<void> {
  const [leagues, clubs, selectable, players, spells, loans] =
    await Promise.all([
      prisma.league.count(),
      prisma.club.count(),
      prisma.club.count({ where: { isSelectable: true } }),
      prisma.player.count(),
      prisma.spell.count(),
      prisma.spell.count({ where: { isLoan: true } }),
    ]);

  console.log("=== Sayımlar ===");
  console.log(`  lig    ${leagues}`);
  console.log(`  kulüp  ${clubs} (seçilebilir ${selectable})`);
  console.log(`  oyuncu ${players}`);
  console.log(`  dönem  ${spells} (kiralık ${loans})`);
}

async function verifyTargetClubs(): Promise<void> {
  console.log("\n=== Zorunlu kulüpler seçilebilir mi? ===");

  for (const { qid, why } of MUST_BE_SELECTABLE) {
    const club = await prisma.club.findUnique({
      where: { wikidataId: qid },
      include: { _count: { select: { spells: true } } },
    });

    if (club === null) {
      check(false, `${qid} veri kümesinde yok — ${why}`);
      continue;
    }
    if (!club.isSelectable) {
      check(false, `${qid} ${club.shortName} seçilemez işaretli — ${why}`);
      continue;
    }

    const count = club._count.spells;
    check(
      count >= MIN_SPELLS,
      `${qid.padEnd(10)} ${club.shortName.padEnd(22)} ${String(count).padStart(4)} dönem`,
    );
  }
}

async function verifyIntegrity(): Promise<void> {
  console.log("\n=== Bütünlük ===");

  const [emptyClubs, stalePlayers, selectableClubs] = await Promise.all([
    prisma.club.count({ where: { spells: { none: {} } } }),
    prisma.player.count({ where: { spells: { none: {} } } }),
    prisma.club.findMany({
      where: { isSelectable: true },
      select: { shortName: true, _count: { select: { spells: true } } },
    }),
  ]);

  // Eşiğin altında kalmasına rağmen seçilebilir işaretli kulüp: yükleme
  // adımının seçilebilirlik hesabı ile veritabanının çeliştiği anlamına gelir.
  // Kullanıcı böyle bir kulübü seçip neredeyse boş sonuç alırdı.
  const weak = selectableClubs.filter((c) => c._count.spells < MIN_SPELLS);

  check(emptyClubs === 0, `dönemi olmayan kulüp: ${emptyClubs}`);
  check(stalePlayers === 0, `dönemi olmayan oyuncu: ${stalePlayers}`);
  check(
    weak.length === 0,
    `seçilebilir ama ${MIN_SPELLS} dönemden az: ${weak.length}` +
      (weak.length > 0
        ? ` (${weak
            .slice(0, 5)
            .map((c) => `${c.shortName}:${c._count.spells}`)
            .join(", ")})`
        : ""),
  );
}

async function verifyKnownPairs(): Promise<void> {
  console.log("\n=== Ortak oyuncu çiftleri ===");

  for (const [aKey, bKey] of KNOWN_PAIRS) {
    const [clubA, clubB] = await Promise.all([
      prisma.club.findFirst({
        where: { searchKey: { contains: aKey }, isSelectable: true },
      }),
      prisma.club.findFirst({
        where: { searchKey: { contains: bKey }, isSelectable: true },
      }),
    ]);

    if (clubA === null || clubB === null) {
      check(false, `${aKey} ∩ ${bKey} — kulüp bulunamadı`);
      continue;
    }

    // BR-2: altyapı dönemleri ortaklık saymaz.
    const count = await prisma.player.count({
      where: {
        AND: [
          { spells: { some: { clubId: clubA.id, isYouth: false } } },
          { spells: { some: { clubId: clubB.id, isYouth: false } } },
        ],
      },
    });

    check(
      count > 0,
      `${clubA.shortName} ∩ ${clubB.shortName} → ${count} ortak oyuncu`,
    );
  }
}

async function main(): Promise<void> {
  try {
    await reportCounts();
    await verifyTargetClubs();
    await verifyIntegrity();
    await verifyKnownPairs();
  } finally {
    await prisma.$disconnect();
  }

  if (failures.length > 0) {
    console.log(`\nKABUL BAŞARISIZ — ${failures.length} kontrol geçmedi:`);
    for (const failure of failures) console.log(`  · ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nKABUL BAŞARILI");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
