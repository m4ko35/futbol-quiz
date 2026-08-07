import type {
  CommonPlayersQuery,
  PlayableCriteriaQuery,
  PlayerRepository,
  PlayerSearchQuery,
} from "@/application/ports/player-repository";
import type { Player } from "@/domain/entities/player";
import type { Spell } from "@/domain/entities/spell";
import type { PlayerSpells } from "@/domain/services/common-players";
import {
  MAX_CELL_ANSWERS,
  MIN_CELL_ANSWERS,
  type GridCriterion,
} from "@/domain/services/grid";
import type { SpellFilter } from "@/domain/services/spell-filter";
import type { StatKey } from "@/domain/services/stat-match";
import { toSearchKey } from "@/domain/value-objects/search-key";
import {
  clubId,
  playerId,
  type PlayerId,
} from "@/domain/value-objects/identifiers";
import { countryName } from "@/lib/country-name";
import { Prisma, type PrismaClient } from "@/generated/prisma";

/**
 * `PlayerRepository` port'unun Prisma uygulaması (PROJECT.md §4.1).
 */
export class PrismaPlayerRepository implements PlayerRepository {
  readonly #prisma: PrismaClient;

  /** Kısıt başına bandda kalan adaylar — `#playableAgainst` önbelleği. */
  readonly #playable = new Map<string, Narrowed>();

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma;
  }

  /**
   * BR-1: A'da EN AZ BİR ve B'de EN AZ BİR nitelikli dönemi olan oyuncular.
   *
   * ÜÇ ADIMLI KESİŞİM, tek sorgu değil — ve bu bilinçli bir tercih:
   *
   * İlk uygulama `players` tablosunda iki `EXISTS` koşulu kullanıyordu. Doğru
   * çalışıyordu ama sorgu planı ölçüldüğünde şu çıktı:
   *
   *   SCAN p USING COVERING INDEX ...   ← 76.358 oyuncunun TAMAMI
   *     CORRELATED SCALAR SUBQUERY ×2   ← her oyuncu için iki indeks araması
   *
   * Yani maliyet sonuca değil, TOPLAM OYUNCU SAYISINA bağlıydı. Kanıtı
   * ölçümde görünüyordu: 128 sonuçlu Milan∩Inter 49,7 ms, 0 sonuçlu rastgele
   * bir çift 43,3 ms — sonuç büyüklüğünün etkisi neredeyse yok.
   *
   * Bu şekil ise iki kadroyu ayrı ayrı, indeks üzerinden okuyup kesiştirir;
   * maliyet yalnızca iki kulübün kadro büyüklüğüne bağlıdır. Ölçüm (200 çift):
   *
   *              p50        p95
   *   EXISTS     43,3 ms    47,7 ms
   *   kesişim     4,2 ms    11,9 ms
   *
   * Asıl kazanç hız değil ÖLÇEKLENME: lig kapsamı genişleyince (Faz 5) eski
   * şekil doğrusal yavaşlardı, bu şekil sabit kalır.
   *
   * İki şeklin aynı sonucu verdiği 60 rastgele çiftte doğrulandı; entegrasyon
   * testleri de port sözleşmesini bağımsız olarak denetliyor.
   */
  async findCommonPlayers(query: CommonPlayersQuery): Promise<PlayerSpells[]> {
    const qualifies = toSpellWhere(query.filter);

    // 1. İki kulübün nitelikli kadroları — `[clubId, playerId]` indeksinden.
    const [atA, atB] = await Promise.all([
      this.#prisma.spell.findMany({
        where: { clubId: query.clubA, ...qualifies },
        select: { playerId: true },
        distinct: ["playerId"],
      }),
      this.#prisma.spell.findMany({
        where: { clubId: query.clubB, ...qualifies },
        select: { playerId: true },
        distinct: ["playerId"],
      }),
    ]);

    // 2. Kesişim. Küçük kümeyi `Set`'e koymak, büyük listeyi tararken
    //    karşılaştırmayı sabit zamana indirir.
    const [smaller, larger] =
      atA.length <= atB.length ? [atA, atB] : [atB, atA];
    const lookup = new Set(smaller.map((spell) => spell.playerId));
    const commonIds = larger
      .map((spell) => spell.playerId)
      .filter((id) => lookup.has(id));

    if (commonIds.length === 0) return [];

    // 3. Yalnızca kesişimdeki oyuncular ve bu iki kulüpteki dönemleri.
    const rows = await this.#prisma.player.findMany({
      where: { id: { in: commonIds } },
      include: {
        spells: {
          where: {
            clubId: { in: [query.clubA, query.clubB] },
            ...qualifies,
          },
          // Sıralamayı domain yapar; buradaki sıra yalnızca sonucu
          // tekrarlanabilir kılmak için (aynı sorgu → aynı satır sırası).
          orderBy: [{ startYear: "asc" }, { id: "asc" }],
        },
      },
    });

    return rows.map(toPlayerSpells);
  }

  /**
   * §9.1 — bir kriteri sağlayan tüm oyuncu kimlikleri.
   *
   * Kulüp kriteri `[clubId, playerId]` indeksinden okunur; ülke kriteri
   * `players` üzerinden. İkisi de yalnızca kimlik seçer — üretim algoritması
   * başka hiçbir alana bakmaz ve satır taşımak boşuna maliyettir.
   */
  async findIdsMatching(criterion: GridCriterion): Promise<PlayerId[]> {
    if (criterion.type === "club") {
      const rows = await this.#prisma.spell.findMany({
        // BR-2: altyapı dönemleri ortaklık saymaz.
        where: { clubId: criterion.clubId, isYouth: false },
        select: { playerId: true },
        distinct: ["playerId"],
      });
      return rows.map((row) => playerId(row.playerId));
    }

    const rows = await this.#prisma.player.findMany({
      where: { nationality: criterion.code },
      select: { id: true },
    });
    return rows.map((row) => playerId(row.id));
  }

  /**
   * BR-25 — "Sen kur" ızgarasında bir eksene konabilecek ölçütler.
   *
   * KESİŞİM UYGULAMADA ALINIYOR, tek sorguda değil. Kısıt başına bir sayım
   * atılıyor (üç sütun → üç sorgu) ve sonuçlar bellekte kesiştiriliyor. Tek
   * sorguya sıkıştırmak, kısıt sayısına göre değişen bir JOIN zinciri üretmek
   * demekti; `generate.ts` aynı kararı aynı gerekçeyle veriyor (kümeleri
   * çek, bellekte kesiştir).
   *
   * BANDI SQL UYGULUYOR (`HAVING`), uygulama değil: eşiği geçemeyen aday
   * satırının ağdan taşınmasının anlamı yok. Kuralın kendisi domain'de
   * (`isCellPlayable`) durmaya devam ediyor ve sınırlar oradan geliyor —
   * iki yerde iki sayı yazılmıyor.
   *
   * ÜLKE × ÜLKE KESİŞİMİ YOKTUR ve bu yüzden bir uyruk kısıtı geldiğinde
   * uyruk adayı üretilmez: bu veri kümesinde bir oyuncunun tek uyruğu var,
   * "Brezilyalı ve Arjantinli" hücresi her zaman boş kalırdı.
   */
  async findPlayableCriteria(
    query: PlayableCriteriaQuery,
  ): Promise<GridCriterion[]> {
    if (query.against.length === 0) return [];

    /*
     * KISITLAR BAĞIMSIZ SORULUR, kesişim uygulamada alınır.
     *
     * "Önce birini sor, sonrakileri AYAKTA KALAN adaylarla sınırla" biçimi
     * denendi ve ÖLÇÜLEREK ELENDİ: p95 143,3 ms'den 332,2 ms'ye çıktı.
     * Sebebi iki katlı — yüzlerce kimliklik bir `IN (...)` listesi
     * `spells(clubId, playerId)` indeksinin işini bozuyor ve zincir,
     * sorguları sıraya sokarak paralellikten de vazgeçiyor. Sezgi yanlıştı;
     * ölçüm kararı verdi.
     */
    const counted = await Promise.all(
      query.against.map((criterion) => this.#playableAgainst(criterion)),
    );

    const clubIds = [...intersect(counted.map((one) => one.clubIds))];
    const codes = [...intersect(counted.map((one) => one.codes))];

    // Kısıtın kendisi aday olamaz: bir ölçüt hem satırda hem sütunda
    // bulunamaz (`isGridShapeValid`).
    const usedClubs = new Set(
      query.against.flatMap((c) =>
        c.type === "club" ? [String(c.clubId)] : [],
      ),
    );
    const usedCodes = new Set(
      query.against.flatMap((c) => (c.type === "nationality" ? [c.code] : [])),
    );

    const key = query.term === null ? null : toSearchKey(query.term);

    /*
     * ÜLKELER ÖNCE, ama listenin YARISINDAN fazlasını kaplamadan.
     *
     * Ölçüldü: üç sütun seçildikten sonra bandda kalan uyruk sayısı tek
     * haneli, kulüp sayısı ise 60–80. Ülkeler sona konsaydı sayfa
     * kelepçesinin (`limit`) altında hiç görünmezlerdi; kelepçeyi tek
     * başlarına doldurmaları da kulüpleri gizlerdi.
     */
    const countries = codes
      .filter((code) => !usedCodes.has(code))
      .map<GridCriterion>((code) => ({
        type: "nationality",
        code,
        label: countryName(code),
      }))
      .filter((c) => key === null || toSearchKey(c.label).includes(key))
      .sort((a, b) => a.label.localeCompare(b.label, "tr"))
      .slice(0, Math.ceil(query.limit / 2));

    const clubs = await this.#clubCriteria(
      clubIds.filter((id) => !usedClubs.has(id)),
      key,
      query.limit - countries.length,
    );

    return [...countries, ...clubs];
  }

  /**
   * Tek bir kısıta göre bandda kalan kulüp kimlikleri ve uyruk kodları.
   *
   * İKİ SORU TEK GİDİŞ-DÖNÜŞTE sorulur (`UNION ALL`).
   *
   * SONUÇ ÖNBELLEKLENİR. Seçici kullanıcı yazdıkça çağrılıyor ve kısıtlar
   * aynı kalıyor; önbellek olmadan her tuş vuruşu aynı sayımı yeniden
   * yaptırırdı. Bayatlama riski YOK — veritabanı salt-okunur bir derleme
   * çıktısı (§3.1), sayımlar süreç boyunca değişmez.
   */
  async #playableAgainst(criterion: GridCriterion): Promise<Narrowed> {
    const key = criterionKey(criterion);
    const cached = this.#playable.get(key);
    if (cached !== undefined) return cached;

    const rows =
      criterion.type === "club"
        ? await this.#prisma.$queryRaw<
            { kind: string; id: string }[]
          >(Prisma.sql`
            SELECT 'club' AS kind, s2.clubId AS id
            FROM spells s1
            JOIN spells s2 ON s2.playerId = s1.playerId AND s2.isYouth = 0
            JOIN clubs c ON c.id = s2.clubId AND c.isSelectable = 1
            WHERE s1.clubId = ${criterion.clubId} AND s1.isYouth = 0
            GROUP BY s2.clubId
            HAVING COUNT(DISTINCT s2.playerId)
                   BETWEEN ${MIN_CELL_ANSWERS} AND ${MAX_CELL_ANSWERS}
            UNION ALL
            SELECT 'nat' AS kind, p.nationality AS id
            FROM spells s
            JOIN players p ON p.id = s.playerId
            WHERE s.clubId = ${criterion.clubId}
              AND s.isYouth = 0
              AND p.nationality IS NOT NULL
            GROUP BY p.nationality
            HAVING COUNT(DISTINCT p.id)
                   BETWEEN ${MIN_CELL_ANSWERS} AND ${MAX_CELL_ANSWERS}`)
        : await this.#prisma.$queryRaw<
            { kind: string; id: string }[]
          >(Prisma.sql`
            SELECT 'club' AS kind, s.clubId AS id
            FROM spells s
            JOIN players p ON p.id = s.playerId
            JOIN clubs c ON c.id = s.clubId AND c.isSelectable = 1
            WHERE p.nationality = ${criterion.code} AND s.isYouth = 0
            GROUP BY s.clubId
            HAVING COUNT(DISTINCT s.playerId)
                   BETWEEN ${MIN_CELL_ANSWERS} AND ${MAX_CELL_ANSWERS}`);

    const result: Narrowed = {
      clubIds: new Set(rows.filter((r) => r.kind === "club").map((r) => r.id)),
      codes: new Set(rows.filter((r) => r.kind === "nat").map((r) => r.id)),
    };

    // §7.1 — sınırsız büyüyen yapı yok: en eski anahtar düşer.
    if (this.#playable.size >= MAX_CACHED_CRITERIA) {
      const oldest = this.#playable.keys().next();
      if (!oldest.done) this.#playable.delete(oldest.value);
    }
    this.#playable.set(key, result);
    return result;
  }

  /** Kimlikleri ölçüte çevirir; arama ve sıralama kulüp aramasıyla aynı. */
  async #clubCriteria(
    ids: readonly string[],
    key: string | null,
    limit: number,
  ): Promise<GridCriterion[]> {
    if (ids.length === 0 || limit <= 0) return [];

    const rows = await this.#prisma.club.findMany({
      where: {
        id: { in: [...ids] },
        isSelectable: true,
        ...(key === null ? {} : { searchKey: { contains: key } }),
      },
      orderBy: { shortName: "asc" },
      take: limit,
      select: { id: true, shortName: true },
    });

    return rows.map((row) => ({
      type: "club",
      clubId: clubId(row.id),
      label: row.shortName,
    }));
  }

  /** BR-12 — cevap doğrulaması; kimlik üzerinden, ad üzerinden DEĞİL. */
  async matchesAll(
    id: PlayerId,
    criteria: readonly GridCriterion[],
  ): Promise<boolean> {
    if (criteria.length === 0) return false;

    const clubIds = criteria
      .filter((c) => c.type === "club")
      .map((c) => (c.type === "club" ? c.clubId : ""));
    const codes = criteria
      .filter((c) => c.type === "nationality")
      .map((c) => (c.type === "nationality" ? c.code : ""));

    // Ülke kriteri birden fazlaysa aynı anda sağlanamaz (bir oyuncunun bu
    // veri kümesinde tek uyruğu var); sorguya gitmeden `false`.
    if (codes.length > 1) return false;

    const player = await this.#prisma.player.findUnique({
      where: { id },
      select: {
        nationality: true,
        spells: {
          where: { clubId: { in: clubIds }, isYouth: false },
          select: { clubId: true },
          distinct: ["clubId"],
        },
      },
    });
    if (player === null) return false;

    const firstCode = codes[0];
    if (firstCode !== undefined && player.nationality !== firstCode) {
      return false;
    }
    // Her kulüp kriteri için EN AZ BİR dönem bulunmuş olmalı.
    return new Set(player.spells.map((s) => s.clubId)).size === clubIds.length;
  }

  /**
   * Oyuncu araması (BR-12).
   *
   * `searchKey` üzerinden aranır — kulüp aramasıyla aynı normalizasyon
   * (Türkçe ı/İ dâhil). Kullanıcının yazdığı ham metin veritabanı alanına
   * doğrudan verilmez.
   */
  async search(query: PlayerSearchQuery): Promise<Player[]> {
    const key = toSearchKey(query.term);
    if (key.length === 0) return [];

    const rows = await this.#prisma.player.findMany({
      where: {
        searchKey: { contains: key },
        ...scoreableWhere(query.scoreableFor),
        ...targetableWhere(query.targetable),
      },
      /**
       * BR-21 — en çok oynayan önce.
       *
       * Alfabetik sıra ÖLÇÜLEREK kullanılamaz bulundu: "buffon" araması
       * Gianluigi'yi 5 adayın 3.'sü, "sane" Leroy'u 51 adayın 34.'sü,
       * "messi" Lionel'i 14 adayın 9.'su olarak veriyordu — yani kullanıcının
       * kastettiği oyuncu çoğu zaman listenin görünen kısmında bile değildi.
       *
       * Dönem SAYISI da denendi ve elendi: "zidane"de Luca (5 dönem)
       * Zinedine'i (4), "kaka"da Stefano Okaka (9) Kaká'yı (3) geçiyordu.
       * Maç sayısı üç örnekte de doğru ayırıyor — Zidane 506/2/0,
       * Kaká 308 / Okaka 194, Buffon 755/377/0.
       *
       * İkincil anahtar alfabetik: oyuncuların %33,9'unun toplam maçı 0 ve
       * eşitlik hâlinde sıranın SABİT olması gerekir; aksi hâlde aynı arama
       * her çağrıda farklı sıralanır.
       */
      orderBy: [{ careerAppearances: "desc" }, { searchKey: "asc" }],
      take: query.limit,
      select: {
        id: true,
        name: true,
        nationality: true,
        position: true,
      },
    });

    return rows.map((row) => ({
      id: playerId(row.id),
      name: row.name,
      nationality: row.nationality,
      position: row.position,
    }));
  }
}

/**
 * BR-16 — o istatistikte puanlanabilir oyuncuların `where` koşulu (§9.2).
 *
 * Kulüp kaynaklı istatistikler (maç, gol, kulüp sayısı) için koşul, §1.3
 * kapsamında eksiksiz bir döneminin bulunmasıdır. Kapsam tutarlılığı zorunlu:
 * hedef 24 ligi saydığı için cevap da öyle sayılır (BR-23,
 * `PrismaStatMatchRepository.findStatValue` ile aynı ölçüt).
 *
 * KÜRATÖRLÜ KISIT BURADAN KALDIRILDI ve sebebi tam olarak aşağıdaki uyarıdır:
 * `findStatValue` 24 lige geçince bu süzgeç küratörlü kalsaydı ikisi yeniden
 * ayrışırdı — seçici gösterir, sunucu reddederdi.
 *
 * `undefined` verilirse süzgeç YOK — ızgara modu her oyuncuyu cevap olarak
 * kabul eder ve o mod bu alanı hiç göndermez.
 */
function scoreableWhere(key: StatKey | undefined): Prisma.PlayerWhereInput {
  if (key === undefined) return {};

  if (key === "nationalCaps") return { nationalCaps: { not: null } };
  if (key === "heightCm") return { heightCm: { not: null } };
  if (key === "weightKg") return { weightKg: { not: null } };

  // Kapsamdaki profesyonel dönemler — hem varlık hem eksiklik koşulunun
  // tabanı. Kulüp kısıtı YOK: değerler artık tüm kapsamı sayıyor.
  const professional: Prisma.SpellWhereInput = { isYouth: false };

  // Kulüp sayısı için bir dönem yeter.
  if (key === "clubs") return { spells: { some: professional } };

  /*
   * Maç ve golde koşul "EN AZ BİR dolu dönem" DEĞİL, "HİÇBİR dönem eksik
   * değil". İkisi farklı ve fark bir kusura yol açmıştı: süzgeç "en az bir
   * dolu" derken `findStatValue` "hiçbiri eksik olmasın" diyordu; seçici
   * oyuncuyu gösteriyor, sunucu reddediyordu — yani süzgecin kaldırmak için
   * eklendiği duvarın aynısı. Kural artık `findStatValue` ile birebir aynı.
   */
  const missing: Prisma.SpellWhereInput = {
    ...professional,
    ...(key === "appearances" ? { appearances: null } : { goals: null }),
  };

  return { spells: { some: professional, none: missing } };
}

/**
 * BR-24 — "Sen seç" turunda HEDEF olabilecek oyuncular.
 *
 * `PrismaStatMatchRepository.findChosenTarget` ile BİREBİR aynı ölçüt olmak
 * ZORUNDA; ayrışırsa seçici gösterir, sunucu reddeder (yukarıdaki kusurun
 * aynısı). Bu yüzden ölçüt, Prisma'nın `where` diliyle tam ifade edilebilecek
 * biçimde seçildi:
 *
 *   · altı istatistiğin üçü oyuncu kaydında  → `not: null`
 *   · 100+ maç                               → `careerAppearances` (§5.2'de
 *     zaten denormalize; eksik dönem yasağıyla birlikte `SUM` ile çakışır)
 *   · hiçbir dönemde eksik maç/gol           → `none`
 *
 * "2+ kulüp" şartı BİLEREK YOK. Günün oyuncusunda o şart TANINIRLIK içindi;
 * burada seçen kullanıcının kendisi. Şartı taşımak, ölçütü Prisma'nın
 * ifade edemeyeceği bir toplamaya çevirir ve süzgeci doğrulayıcıdan yeniden
 * ayrıştırırdı. Ölçülen bedel: havuz 5.242 yerine 5.524 (§9.2).
 */
function targetableWhere(
  targetable: boolean | undefined,
): Prisma.PlayerWhereInput {
  if (targetable !== true) return {};

  return {
    nationalCaps: { not: null },
    heightCm: { not: null },
    weightKg: { not: null },
    careerAppearances: { gte: MIN_TARGET_APPEARANCES },
    spells: {
      none: {
        isYouth: false,
        OR: [{ appearances: null }, { goals: null }],
      },
    },
  };
}

/** §9.2 — `findChosenTarget` ile aynı eşik; ikisi birlikte değişir. */
const MIN_TARGET_APPEARANCES = 100;

/**
 * `spellQualifies` kuralının SQL karşılığı (BR-2, BR-3).
 *
 * DİKKAT: bu, domain kuralının KOPYASI değil ÇEVİRİSİDİR ve çeviriler
 * bozulabilir. İkisinin aynı kaldığı `tests/integration` altında ölçülür:
 * test, filtrelenmemiş satırları çekip domain yüklemini bellekte uygular ve
 * sonucun bu sorgununkiyle birebir aynı olmasını bekler.
 *
 * Kural değişirse ÖNCE `spellQualifies` güncellenir, sonra burası.
 */
function toSpellWhere(filter: SpellFilter): {
  isYouth?: false;
  isLoan?: false;
} {
  return {
    ...(filter.includeYouth ? {} : { isYouth: false as const }),
    ...(filter.includeLoans ? {} : { isLoan: false as const }),
  };
}

interface SpellRow {
  playerId: string;
  clubId: string;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  isLoan: boolean;
  isYouth: boolean;
  appearances: number | null;
  goals: number | null;
}

interface PlayerRow {
  id: string;
  name: string;
  nationality: string | null;
  position: string | null;
  spells: SpellRow[];
}

function toPlayerSpells(row: PlayerRow): PlayerSpells {
  return {
    player: {
      id: playerId(row.id),
      name: row.name,
      nationality: row.nationality,
      position: row.position,
    },
    spells: row.spells.map(toSpell),
  };
}

function toSpell(row: SpellRow): Spell {
  return {
    playerId: playerId(row.playerId),
    clubId: clubId(row.clubId),
    years: { start: row.startYear, end: row.endYear },
    isCurrent: row.isCurrent,
    isLoan: row.isLoan,
    isYouth: row.isYouth,
    appearances: row.appearances,
    goals: row.goals,
  };
}

/** Bir kısıt zincirinde AYAKTA KALAN adaylar. */
interface Narrowed {
  readonly clubIds: Set<string>;
  readonly codes: Set<string>;
}

/** Ölçüt için önbellek anahtarı; `generate.ts` ile aynı biçim. */
function criterionKey(criterion: GridCriterion): string {
  return criterion.type === "club"
    ? `club:${String(criterion.clubId)}`
    : `nat:${criterion.code}`;
}

/**
 * Önbellekte tutulacak azami ölçüt sayısı.
 *
 * Bir ızgara en çok beş kısıt kullanıyor; sınır, aynı süreçte arka arkaya
 * kurulan ızgaraların birbirinin sonucunu ısıtmasına yetecek kadar geniş,
 * belleği bağlayacak kadar dar (§7.1).
 */
const MAX_CACHED_CRITERIA = 128;

/**
 * Kümelerin kesişimi — en küçüğünden başlar.
 *
 * `findPlayableCriteria` bunu kısıt başına bir kez çağırır; kısıt sayısı en
 * çok beş olduğu için basit tarama yeterli.
 */
function intersect(sets: readonly Set<string>[]): Set<string> {
  const first = sets[0];
  if (first === undefined) return new Set<string>();

  const rest = sets.slice(1);
  const result = new Set<string>();
  for (const value of first) {
    if (rest.every((other) => other.has(value))) result.add(value);
  }
  return result;
}
