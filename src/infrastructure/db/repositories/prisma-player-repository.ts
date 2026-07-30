import type {
  CommonPlayersQuery,
  PlayerRepository,
} from "@/application/ports/player-repository";
import type { Spell } from "@/domain/entities/spell";
import type { PlayerSpells } from "@/domain/services/common-players";
import type { SpellFilter } from "@/domain/services/spell-filter";
import { clubId, playerId } from "@/domain/value-objects/identifiers";
import type { PrismaClient } from "@/generated/prisma";

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
}

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
