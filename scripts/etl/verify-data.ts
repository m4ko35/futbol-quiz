import { GRID_CLUB_QIDS } from "../../src/application/game-modes/grid/pool";
import { PrismaClient } from "../../src/generated/prisma";
import { MIN_SPELLS_FOR_SELECTABLE } from "./leagues";
import { POSITIONS } from "./pipeline/normalize";

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

/**
 * BR-8 — kanıtsız dönem oranının tavanı (PROJECT.md §8.2).
 *
 * Kanıtsız dönemler elenmiyor, etiketleniyor. Etiketlemenin dürüst kalması
 * oranın küçük kalmasına bağlıdır: oran büyürse arayüzdeki uyarı bir istisnayı
 * değil ÇOĞUNLUĞU tarif etmeye başlar ve hiçbir şey ifade etmez.
 *
 * Ölçülen değer %11,7 (2026-07-30). Tavan, mevcut gürültüyü cezalandırmak için
 * değil KÖTÜLEŞMEYİ yakalamak için var; bu yüzden gerçekçi bir tamponla konur.
 * Wikidata'nın belgelenmemiş kayıtları temizlemesi oranı düşürebilir, yeni lig
 * kapsamı yükseltebilir — %18'i aşması ise kaynakta yapısal bir değişiklik
 * demektir ve bakılmadan yayına çıkmamalıdır.
 */
const MAX_UNEVIDENCED_RATIO = 0.18;

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

/**
 * BR-8 kanıt oranı — §8.2.
 *
 * Ölçüt `hasEvidence`'ın olumsuzudur ve DOMAIN'DEKİ kuralla aynı dört alana
 * bakar. Burada Prisma `where`'i olarak yazılmış olması bir kopya değil bir
 * çeviridir; kural değişirse önce `hasEvidence` güncellenir, sonra burası.
 */
async function verifyEvidenceRatio(): Promise<void> {
  console.log("\n=== Kanıt düzeyi (BR-8) ===");

  const [total, unevidenced] = await Promise.all([
    prisma.spell.count(),
    prisma.spell.count({
      where: {
        startYear: null,
        endYear: null,
        appearances: null,
        goals: null,
      },
    }),
  ]);

  if (total === 0) {
    check(false, "hiç dönem kaydı yok");
    return;
  }

  const ratio = unevidenced / total;
  check(
    ratio <= MAX_UNEVIDENCED_RATIO,
    `kanıtsız dönem ${unevidenced}/${total} = %${(ratio * 100).toFixed(1)} ` +
      `(tavan %${(MAX_UNEVIDENCED_RATIO * 100).toFixed(0)})`,
  );
}

/**
 * Mevki alanı kapalı bir kümedir.
 *
 * NEDEN VAR: `normalizePosition` bir dönem tanımadığı etiketi HAM hâliyle
 * geçiriyordu ve Wikidata'nın `P413` alanı yalnızca futbol mevkisi taşımıyor.
 * Veri kümesine bir bakanlık ("İçişleri Bakanlığı (İngiltere)"), bir kişi adı
 * ("Iván Luquetta"), çözülememiş bir QID ve kriket/ragbi/voleybol mevkileri
 * girmişti — hepsi arayüzde oyuncunun mevkisi olarak görünüyordu.
 *
 * Kural düzeltildi; bu kontrol düzeltmenin GEÇERLİ KALDIĞINI ölçer. Kaynak
 * yeni bir etiket üretirse ya da kural gevşetilirse veri yenilendiği anda
 * patlar, yayına çıkmadan önce.
 */
async function verifyPositions(): Promise<void> {
  console.log("\n=== Mevki değerleri ===");

  const rows = await prisma.player.groupBy({
    by: ["position"],
    _count: { _all: true },
  });

  const unexpected = rows.filter(
    (row) => row.position !== null && !POSITIONS.includes(row.position),
  );

  check(
    unexpected.length === 0,
    `beklenmeyen mevki değeri: ${unexpected.length}` +
      (unexpected.length > 0
        ? ` (${unexpected
            .slice(0, 5)
            .map((row) => `${String(row.position)}:${String(row._count._all)}`)
            .join(", ")})`
        : ` — izin verilenler: ${POSITIONS.join(", ")}`),
  );
}

/**
 * Izgara havuzu — §9.1.
 *
 * NEDEN BURADA: havuz kodda sabit bir QID listesidir, veri ise altı ayda bir
 * yenilenir. Wikidata bir kulübü başka bir varlığa birleştirirse ya da kulüp
 * seçilebilirlik eşiğinin altına düşerse, havuzdaki satır sessizce ölü bir
 * göndermeye dönüşür: üretim o kulübü hiç seçmez ve kimse fark etmez.
 * Burada patlar — veri yenilendiği anda, yayına çıkmadan önce.
 *
 * Kulüp sayısı da denetlenir: ızgara üç sütun ister, dördün altına düşen bir
 * havuz `generateGrid`'i her gün başarısız kılar.
 */
async function verifyGridPool(): Promise<void> {
  console.log("\n=== Izgara havuzu (§9.1) ===");

  const found = await prisma.club.findMany({
    where: { wikidataId: { in: [...GRID_CLUB_QIDS] }, isSelectable: true },
    select: { wikidataId: true },
  });

  const present = new Set(found.map((club) => club.wikidataId));
  const missing = GRID_CLUB_QIDS.filter((qid) => !present.has(qid));

  check(
    missing.length === 0,
    `havuzdaki ${GRID_CLUB_QIDS.length} QID'den ${present.size} tanesi seçilebilir` +
      (missing.length > 0 ? ` — eksik: ${missing.join(", ")}` : ""),
  );
  check(
    present.size >= 4,
    `üretim için yeterli kulüp var (${present.size} ≥ 4)`,
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
    await verifyEvidenceRatio();
    await verifyPositions();
    await verifyGridPool();
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
