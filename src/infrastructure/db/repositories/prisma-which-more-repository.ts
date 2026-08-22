import { CURATED_CLUB_QIDS } from "@/application/curated-clubs";
import type {
  WhichMoreCandidate,
  WhichMoreCandidateQuery,
  WhichMoreRepository,
} from "@/application/ports/which-more-repository";
import {
  officialTotal,
  STAT_KEYS,
  type StatKey,
} from "@/domain/services/stat-match";
import {
  isWellKnown,
  LEVELS,
  MIN_GAP,
  type Level,
} from "@/domain/services/which-more";
import { playerId, type PlayerId } from "@/domain/value-objects/identifiers";
import { Prisma, type PrismaClient } from "@/generated/prisma";
import { yearOf } from "../birth-year";

/**
 * "Hangisi daha" deposu — PROJECT.md §9.3.
 *
 * HAVUZ BİR KEZ KURULUP BELLEKTE TUTULUR. Gerekçe §3.1'dir: veri bir DERLEME
 * ÇIKTISIDIR, süreç boyunca değişmez. Tanınırlık sorgusu 400 binden fazla
 * dönemi tarıyor ve her tuşta değil, süreç başına bir kez ödenmeli — seçim
 * etkileşimli bir yolda (kullanıcı her turda bekliyor).
 *
 * Aynı gerekçe `PrismaPlayerRepository`'nin ölçüt önbelleğinde de yazılı; orada
 * ölçülen kazanç 148 ms → 1,6 ms idi.
 *
 * SEVİYE HAVUZU İKİYE AYIRIR, sorguyu değil (BR-41): tek bir sorgu koşar,
 * satırlar bellekte "bilindik" ölçütüne göre iki liste kümesine dağıtılır.
 * İki ayrı SQL sorgusu, aynı tanınırlık taramasını iki kez ödemek olurdu.
 *
 * SEÇİM SQL'DE DEĞİL BELLEKTE yapılıyor. `ORDER BY RANDOM()` her çağrıda
 * havuzu yeniden kurmak demekti; sıralı bir dizide ikili arama ise bandın iki
 * ucunu O(log n) bulur.
 */

/** Havuzda bir oyuncunun tek bir istatistikteki kaydı. */
interface PoolEntry {
  readonly id: string;
  readonly name: string;
  readonly value: number;
}

/** Değere göre ARTAN sıralı diziler — ikili arama bunu şart koşar. */
type StatLists = Readonly<Record<StatKey, readonly PoolEntry[]>>;

/**
 * BR-41 — seviye başına AYRI liste kümesi.
 *
 * Alternatif, tek listede `isEasy` bayrağı taşıyıp seçim anında elemekti; o
 * yol ikili aramayı bozar. İndeks aritmetiği listenin YOĞUN olmasına dayanıyor
 * ve kolay oyuncular havuzun beşte biri: bandın içindeki rastgele seçim
 * sistematik olarak dışlanana denk gelir, her tur `MAX_RANDOM_TRIES` deneyip
 * tam taramaya düşerdi.
 *
 * Bedeli belleğin iki katı DEĞİL: `PoolEntry` nesneleri iki liste arasında
 * PAYLAŞILIYOR, çoğalan yalnızca işaretçi dizisi (~8.000 işaretçi).
 */
type Pool = Readonly<Record<Level, StatLists>>;

interface PoolRow {
  id: string;
  name: string;
  nationalCaps: number | bigint | null;
  nationalGoals: number | bigint | null;
  heightCm: number | bigint | null;
  /** Doğum YILI ayrı bir sütun değil, buradan türetilir — §9.2. */
  birthDate: Date | null;
  /** Kulüp kariyerinin TAMAMI; millî tarafla toplanır (BR-23). */
  clubAppearances: number | bigint | null;
  clubGoals: number | bigint | null;
  clubs: number | bigint;
}

/**
 * Havuz sorgusunun EK alanı.
 *
 * Ayrı tip, çünkü tekil okuma yolu (`#valueOf`) bu sütunu seçmiyor ve
 * seçmesine gerek de yok — seviye yalnızca havuz kurulurken sorulur (BR-41).
 * `PoolRow`'a eklenseydi tip, tekil sorguda hiç dolmayan bir alan vaat ederdi.
 */
interface PoolBuildRow extends PoolRow {
  /** Altyapı dışı EN SON dönem yılı — BR-41'in ikinci ölçütü. */
  lastYear: number | bigint | null;
}

interface ClubRow {
  shortName: string;
}

/**
 * Rastgele denemenin tavanı.
 *
 * Dışlama listesi en çok 200 (BR-28). En dar havuz artık BR-41'in kolay
 * seviyesinde: ölçüldü, 1.271 oyuncu (kulüp maçı/golü). Yani rastgele bir
 * seçimin dışlanmış çıkma olasılığı en kötü hâlde %15,7 ve 25 denemenin
 * hepsinin ıskalama olasılığı 10⁻²⁰ mertebesinde. Yine de tarama yedeği var:
 * "çok düşük olasılık" ile "imkânsız" aynı şey değil.
 */
const MAX_RANDOM_TRIES = 25;

/** Oyuncuyu TANITMAK için gösterilen kulüp sayısı. */
const SHOWN_CLUBS = 3;

export class PrismaWhichMoreRepository implements WhichMoreRepository {
  readonly #prisma: PrismaClient;
  readonly #random: () => number;

  /** Söz olarak tutuluyor: eşzamanlı iki istek havuzu iki kez kurmasın. */
  #pool: Promise<Pool> | null = null;

  constructor(prisma: PrismaClient, random: () => number = Math.random) {
    this.#prisma = prisma;
    this.#random = random;
  }

  async findCandidate(
    query: WhichMoreCandidateQuery,
  ): Promise<WhichMoreCandidate | null> {
    const pool = await this.#load();
    const list = pool[query.level][query.statKey];
    const excluded = new Set<string>(query.exclude);

    const ranges = this.#ranges(list, query);
    const entry = this.#pick(list, ranges, excluded);
    if (entry === null) return null;

    return {
      id: playerId(entry.id),
      name: entry.name,
      clubs: await this.#clubsOf(entry.id),
      value: entry.value,
    };
  }

  async findPlayer(
    id: PlayerId,
    statKey: StatKey,
  ): Promise<WhichMoreCandidate | null> {
    const value = await this.#valueOf(id, statKey);
    if (value === null) return null;

    const player = await this.#prisma.player.findUnique({
      where: { id },
      select: { name: true },
    });
    if (player === null) return null;

    return {
      id,
      name: player.name,
      clubs: await this.#clubsOf(id),
      value,
    };
  }

  /**
   * BR-29 + BR-30 — bandı ve tarafı, seçilebilir indeks aralıklarına çevirir.
   *
   * İki aralık dönebilir ("any" durumunda bandın iki yanı); seçim ikisi
   * arasında BOYUTLA ORANTILI yapılır, aksi hâlde küçük tarafın oyuncuları
   * sistematik olarak daha sık çıkardı.
   */
  #ranges(
    list: readonly PoolEntry[],
    query: WhichMoreCandidateQuery,
  ): readonly (readonly [number, number])[] {
    if (query.threshold === null) return [[0, list.length]];

    const gap = MIN_GAP[query.statKey];
    const above = [
      lowerBound(list, query.threshold + gap),
      list.length,
    ] as const;
    const below = [0, lowerBound(list, query.threshold - gap + 1)] as const;

    if (query.side === "above") return [above];
    if (query.side === "below") return [below];
    return [below, above];
  }

  #pick(
    list: readonly PoolEntry[],
    ranges: readonly (readonly [number, number])[],
    excluded: ReadonlySet<string>,
  ): PoolEntry | null {
    const sizes = ranges.map(([lo, hi]) => Math.max(0, hi - lo));
    const total = sizes.reduce((sum, size) => sum + size, 0);
    if (total === 0) return null;

    for (let attempt = 0; attempt < MAX_RANDOM_TRIES; attempt++) {
      let offset = Math.floor(this.#random() * total);
      for (const [index, size] of sizes.entries()) {
        if (offset < size) {
          const range = ranges[index];
          const entry =
            range === undefined ? undefined : list[range[0] + offset];
          if (entry !== undefined && !excluded.has(entry.id)) return entry;
          break;
        }
        offset -= size;
      }
    }

    // Yedek: rastgele denemeler dışlananlara denk geldi. Tarama, seçimi
    // rastgelelikten çıkarmaz — ilk uygun değil, uygunlar arasından rastgele
    // biri alınır.
    const usable: PoolEntry[] = [];
    for (const [lo, hi] of ranges) {
      for (let i = lo; i < hi; i++) {
        const entry = list[i];
        if (entry !== undefined && !excluded.has(entry.id)) usable.push(entry);
      }
    }
    if (usable.length === 0) return null;
    return usable[Math.floor(this.#random() * usable.length)] ?? null;
  }

  /**
   * Tek bir oyuncunun tek bir istatistikteki değeri.
   *
   * §9.2'nin `findStatValue`'suyla AYNI kuralları uygular ve bu bir tercih
   * değil zorunluluktur: havuzdaki değer ile cevap anındaki değer ayrışırsa
   * sunucu, cevap ucunun reddedeceği bir çift kurar. Bütünleşme testi ikisini
   * karşılaştırıyor.
   */
  async #valueOf(id: PlayerId, key: StatKey): Promise<number | null> {
    if (key === "nationalCaps" || key === "heightCm" || key === "birthYear") {
      const player = await this.#prisma.player.findUnique({
        where: { id },
        select: { nationalCaps: true, heightCm: true, birthDate: true },
      });
      if (player === null) return null;
      if (key === "birthYear") return yearOf(player.birthDate);
      return player[key];
    }

    const rows = await this.#prisma.$queryRaw<PoolRow[]>(Prisma.sql`
      SELECT p.id AS id, p.name AS name,
             p.nationalCaps  AS nationalCaps,
             p.nationalGoals AS nationalGoals,
             p.heightCm      AS heightCm,
             p.birthDate     AS birthDate,
             p.clubCareerAppearances AS clubAppearances,
             p.clubCareerGoals       AS clubGoals,
             COUNT(DISTINCT s.clubId) AS clubs
      FROM players p
      JOIN spells s ON s.playerId = p.id AND s.isYouth = 0
      WHERE p.id = ${id}
      GROUP BY p.id
    `);

    const row = rows[0];
    return row === undefined ? null : valueOf(row, key);
  }

  /** Tanıtım kulüpleri — en çok oynadığı üçü. */
  async #clubsOf(id: string): Promise<readonly string[]> {
    const rows = await this.#prisma.$queryRaw<ClubRow[]>(Prisma.sql`
      SELECT c.shortName AS shortName
      FROM spells s
      JOIN clubs c ON c.id = s.clubId
      WHERE s.playerId = ${id} AND s.isYouth = 0
      GROUP BY c.id
      ORDER BY SUM(COALESCE(s.appearances, 0)) DESC, c.shortName ASC
      LIMIT ${SHOWN_CLUBS}
    `);
    return rows.map((row) => row.shortName);
  }

  #load(): Promise<Pool> {
    this.#pool ??= this.#buildPool();
    return this.#pool;
  }

  /**
   * BR-31 — tanınırlık havuzu.
   *
   * BR-15'in ölçütünün AYNISI (küratörlü kulüplerde 100+ maç, 2+ kulüp) ama
   * altı istatistiğin dolu olması ARANMAZ: burada yalnızca sorulan istatistik
   * gerekiyor. Ölçüldü (§9.3): 6.464 oyuncu, istatistik başına 3.333–6.464.
   */
  async #buildPool(): Promise<Pool> {
    const rows = await this.#prisma.$queryRaw<PoolBuildRow[]>(Prisma.sql`
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
      SELECT p.id AS id, p.name AS name,
             p.nationalCaps  AS nationalCaps,
             p.nationalGoals AS nationalGoals,
             p.heightCm      AS heightCm,
             p.birthDate     AS birthDate,
             p.clubCareerAppearances AS clubAppearances,
             p.clubCareerGoals       AS clubGoals,
             COUNT(DISTINCT s.clubId) AS clubs,
             MAX(COALESCE(s.endYear, s.startYear)) AS lastYear
      FROM players p
      JOIN taninir t ON t.pid = p.id
      JOIN spells  s ON s.playerId = p.id AND s.isYouth = 0
      GROUP BY p.id
    `);

    const lists: Record<Level, Record<StatKey, PoolEntry[]>> = {
      easy: emptyLists(),
      hard: emptyLists(),
    };

    for (const row of rows) {
      // Ölçüt DOMAIN'de (BR-41); burada yalnızca uygulanıyor. SQL'e gömülseydi
      // eşikler test edilemez ve §9.3'ün ölçümleriyle ayrışabilirdi.
      const wellKnown = isWellKnown(
        toNumber(row.nationalCaps),
        toNumber(row.lastYear),
      );

      for (const key of STAT_KEYS) {
        const value = valueOf(row, key);
        // Değeri olmayan oyuncu O İSTATİSTİĞİN havuzunda yer almaz (BR-31);
        // diğerlerinde durur.
        if (value === null) continue;

        // Aynı nesne iki listeye girer; kayıtlar salt okunur.
        const entry: PoolEntry = { id: row.id, name: row.name, value };
        lists.hard[key].push(entry);
        // "hard" KAPSAYICIDIR: kolay oyuncular her iki havuzda da bulunur.
        if (wellKnown) lists.easy[key].push(entry);
      }
    }

    for (const level of LEVELS) {
      for (const key of STAT_KEYS) {
        lists[level][key].sort((a, b) => a.value - b.value);
      }
    }
    return lists;
  }
}

function emptyLists(): Record<StatKey, PoolEntry[]> {
  return {
    appearances: [],
    goals: [],
    clubs: [],
    nationalCaps: [],
    heightCm: [],
    birthYear: [],
  };
}

/**
 * Ham satırdan tek bir istatistiğin değeri — havuz ile tekil okuma AYNI
 * fonksiyonu kullanır ki ikisi ayrışamasın.
 */
function valueOf(row: PoolRow, key: StatKey): number | null {
  if (key === "nationalCaps") return toNumber(row.nationalCaps);
  if (key === "heightCm") return toNumber(row.heightCm);
  if (key === "birthYear") return yearOf(row.birthDate);

  if (key === "clubs") {
    const clubs = Number(row.clubs);
    // Kapsamda hiç dönemi yok: bu istatistikte 0 DEĞİL, bilinmiyor (§2.7).
    return clubs === 0 ? null : clubs;
  }

  // BR-23 — resmî toplam; parçalardan biri eksikse toplam da bilinmiyor.
  return key === "appearances"
    ? officialTotal(toNumber(row.clubAppearances), toNumber(row.nationalCaps))
    : officialTotal(toNumber(row.clubGoals), toNumber(row.nationalGoals));
}

function toNumber(value: number | bigint | null): number | null {
  return value === null ? null : Number(value);
}

/** `value >= target` olan ilk indeks. Dizi ARTAN sıralı olmalıdır. */
function lowerBound(list: readonly PoolEntry[], target: number): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((list[mid]?.value ?? 0) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * BR-15'in tanınırlık eşikleri — §9.2 ile AYNI sayılar.
 *
 * Kopyalanmış görünüyor ve öyle: `prisma-stat-match-repository.ts` de aynı
 * ikisini tutuyor. Ortak bir sabite çıkarılmadı çünkü iki modun eşikleri
 * KAVRAMSAL OLARAK bağımsız — biri "günün oyuncusu tanınsın", diğeri
 * "karşılaştırılan iki isim tanınsın" diyor. Ortak sabit, birini değiştirmek
 * isteyen kişiyi diğerini de değiştirmeye zorlardı.
 */
const MIN_APPEARANCES = 100;
const MIN_CLUBS = 2;
