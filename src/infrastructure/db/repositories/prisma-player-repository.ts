import type {
  CommonPlayersQuery,
  PlayerRepository,
  PlayerSearchQuery,
} from "@/application/ports/player-repository";
import type { Player } from "@/domain/entities/player";
import type { Spell } from "@/domain/entities/spell";
import type { PlayerSpells } from "@/domain/services/common-players";
import type { GridCriterion } from "@/domain/services/grid";
import type { SpellFilter } from "@/domain/services/spell-filter";
import type { StatKey } from "@/domain/services/stat-match";
import { toSearchKey } from "@/domain/value-objects/search-key";
import {
  clubId,
  playerId,
  type PlayerId,
} from "@/domain/value-objects/identifiers";
import type { Prisma, PrismaClient } from "@/generated/prisma";

/**
 * `PlayerRepository` port'unun Prisma uygulaması (PROJECT.md §4.1).
 */
export class PrismaPlayerRepository implements PlayerRepository {
  readonly #prisma: PrismaClient;

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
