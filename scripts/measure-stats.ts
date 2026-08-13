/**
 * İstatistik sabitlerini ÖLÇER ve koddaki değerlerle karşılaştırır —
 * PROJECT.md §9.2, §9.3.
 *
 * NEDEN BU BETİK VAR. `STAT_DEVIATIONS` ve `MIN_GAP` "ölçülerek konur, veri
 * kümesi yenilendiğinde ölçüm tekrarlanır" diye yazılmıştı ama tekrarlayacak
 * bir araç yoktu. Sonuç ölçüldü: lig kapsamı 6'dan 24'e çıkarken `clubs`
 * sapması 1,2'de kaldı, gerçek değer **2,2** olmuştu — yani o istatistik
 * oyunun tasarlandığından iki kat sert puanlanıyordu ve kimse fark etmedi.
 * Bir belge sözü, onu tutacak araç olmadan bayatlar.
 *
 * ÇIKTI KOD DEĞİL RAPORDUR. Sabitleri kendiliğinden güncellemez: sapma
 * değişimi bir ürün kararıdır (oyunun zorluğunu değiştirir) ve sessizce
 * yapılmamalıdır. Betik farkı gösterir, kararı insan verir.
 *
 *   npm run stats:measure
 */
import { CURATED_CLUB_QIDS } from "../src/application/curated-clubs";
import {
  STAT_DEVIATIONS,
  STAT_KEYS,
  type StatKey,
} from "../src/domain/services/stat-match";
import { MIN_GAP } from "../src/domain/services/which-more";
import { Prisma, PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

/** BR-15/BR-31 tanınırlık eşiği — depolardaki değerlerin aynısı. */
const MIN_APPEARANCES = 100;
const MIN_CLUBS = 2;

/** Sapmanın koddaki değerden bu orandan fazla sapması RAPORLANIR. */
const DRIFT_TOLERANCE = 0.15;

interface Row {
  birthDate: Date | null;
  nationalCaps: number | bigint | null;
  heightCm: number | bigint | null;
  appearances: number | bigint | null;
  goals: number | bigint | null;
  clubs: number | bigint;
  missing: number | bigint;
}

/** Tanınırlık havuzu — §9.3'ün havuzu; istatistik başına boş olabilir. */
async function recognizablePool(): Promise<Row[]> {
  return prisma.$queryRaw<Row[]>(Prisma.sql`
    WITH taninir AS (
      SELECT s.playerId AS pid
      FROM spells s
      JOIN clubs c ON c.id = s.clubId
      WHERE s.isYouth = 0
        AND c.wikidataId IN (${Prisma.join(CURATED_CLUB_QIDS)})
      GROUP BY s.playerId
      HAVING SUM(s.appearances) >= ${MIN_APPEARANCES}
         AND COUNT(DISTINCT s.clubId) >= ${MIN_CLUBS}
    )
    SELECT p.birthDate, p.nationalCaps, p.heightCm,
           SUM(s.appearances)       AS appearances,
           SUM(s.goals)             AS goals,
           COUNT(DISTINCT s.clubId) AS clubs,
           SUM(CASE WHEN s.appearances IS NULL OR s.goals IS NULL THEN 1 ELSE 0 END) AS missing
    FROM players p
    JOIN taninir t ON t.pid = p.id
    JOIN spells  s ON s.playerId = p.id AND s.isYouth = 0
    GROUP BY p.id
  `);
}

function valueOf(row: Row, key: StatKey): number | null {
  const num = (v: number | bigint | null): number | null =>
    v === null ? null : Number(v);

  switch (key) {
    case "birthYear":
      return row.birthDate === null ? null : row.birthDate.getUTCFullYear();
    case "nationalCaps":
      return num(row.nationalCaps);
    case "heightCm":
      return num(row.heightCm);
    case "clubs":
      return num(row.clubs);
    // Maç ve gol, dönemlerden toplanır; eksik dönem varsa toplam YANILTICIDIR.
    case "appearances":
      return Number(row.missing) > 0 ? null : num(row.appearances);
    case "goals":
      return Number(row.missing) > 0 ? null : num(row.goals);
  }
}

function standardDeviation(values: readonly number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Rastgele iki oyuncuda farkın banttan KÜÇÜK çıkma oranı (%). */
function eliminationRate(sorted: readonly number[], gap: number): number {
  // Sıralı dizide, her değer için |fark| < gap olan komşuların sayısı ikili
  // aramayla bulunur; O(n log n), örneklemeye gerek yok.
  let pairs = 0;
  for (const v of sorted) {
    pairs += upperBound(sorted, v + gap - 1) - lowerBound(sorted, v - gap + 1);
  }
  // Kendisiyle eşleşmeler çıkarılır.
  return (
    ((pairs - sorted.length) / (sorted.length * (sorted.length - 1))) * 100
  );
}

/**
 * BR-30 — turun TEK YANLI kalma oranı (%).
 *
 * Yazı tura hangi tarafı seçerse seçsin o taraf boşsa öteki tarafa düşülür;
 * o turda rakip artık %50 olasılıkla gelmiyor. Oran yükseldikçe "hep kalanı
 * seç" sömürüsüne alan açılır, o yüzden ölçülür.
 */
function oneSidedRate(sorted: readonly number[], gap: number): number {
  let oneSided = 0;
  for (const v of sorted) {
    const aboveEmpty = lowerBound(sorted, v + gap) >= sorted.length;
    const belowEmpty = lowerBound(sorted, v - gap + 1) === 0;
    if (aboveEmpty || belowEmpty) oneSided++;
  }
  return (oneSided / sorted.length) * 100;
}

function lowerBound(sorted: readonly number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] ?? 0) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(sorted: readonly number[], target: number): number {
  return lowerBound(sorted, target + 1);
}

function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
}

async function main(): Promise<void> {
  const rows = await recognizablePool();
  const pad = (s: string | number, n: number): string => String(s).padStart(n);

  console.log(`\n=== Tanınırlık havuzu (BR-31) — ${rows.length} oyuncu ===\n`);
  console.log(
    "istatistik      havuz  kapsam    min    p25  medyan    p75    p95    max",
  );
  const sortedByKey = new Map<StatKey, number[]>();
  for (const key of STAT_KEYS) {
    const values = rows
      .map((r) => valueOf(r, key))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    sortedByKey.set(key, values);
    console.log(
      `${key.padEnd(14)}${pad(values.length, 6)}  ${pad(((values.length / rows.length) * 100).toFixed(1) + "%", 6)}` +
        `${pad(percentile(values, 0), 7)}${pad(percentile(values, 0.25), 7)}` +
        `${pad(percentile(values, 0.5), 8)}${pad(percentile(values, 0.75), 7)}` +
        `${pad(percentile(values, 0.95), 7)}${pad(percentile(values, 1), 7)}`,
    );
  }

  console.log(`\n=== BR-29 bandı ve BR-30 tek yanlılık ===\n`);
  console.log("istatistik      band   elenen çift   tek yanlı tur");
  for (const key of STAT_KEYS) {
    const values = sortedByKey.get(key) ?? [];
    const gap = MIN_GAP[key];
    console.log(
      `${key.padEnd(14)}${pad(gap, 5)}${pad(eliminationRate(values, gap).toFixed(1) + "%", 14)}${pad(oneSidedRate(values, gap).toFixed(1) + "%", 16)}`,
    );
  }

  // BR-15 havuzu: ALTI istatistiğin de dolu olması istenir (§9.2).
  const candidates = rows.filter((r) =>
    STAT_KEYS.every((k) => valueOf(r, k) !== null),
  );

  console.log(
    `\n=== BR-15 aday havuzu — ${candidates.length} oyuncu (STAT_DEVIATIONS bu havuzda ölçülür) ===\n`,
  );
  console.log("istatistik      ölçülen SD   koddaki SD   fark");

  let drifted = 0;
  for (const key of STAT_KEYS) {
    const values = candidates
      .map((r) => valueOf(r, key))
      .filter((v): v is number => v !== null);
    const measured = standardDeviation(values);
    const configured = STAT_DEVIATIONS[key];
    const drift = Math.abs(measured - configured) / configured;
    const flag = drift > DRIFT_TOLERANCE ? "  ← BAYAT" : "";
    if (drift > DRIFT_TOLERANCE) drifted++;
    console.log(
      `${key.padEnd(14)}${pad(measured.toFixed(1), 11)}${pad(configured.toFixed(1), 13)}${pad((drift * 100).toFixed(0) + "%", 7)}${flag}`,
    );
  }

  console.log(
    drifted === 0
      ? "\nSabitler ölçümle uyumlu.\n"
      : `\n${String(drifted)} sabit %${String(DRIFT_TOLERANCE * 100)}'ten fazla saptı — §9.2 güncellenmeli.\n`,
  );

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
