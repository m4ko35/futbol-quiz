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

  async findCommonPlayers(query: CommonPlayersQuery): Promise<PlayerSpells[]> {
    const qualifies = toSpellWhere(query.filter);

    const rows = await this.#prisma.player.findMany({
      where: {
        // BR-1: A'da EN AZ BİR ve B'de EN AZ BİR nitelikli dönem.
        //
        // İki ayrı `some` koşulu kullanılıyor; tek bir `clubId: { in: [a, b] }`
        // koşulu YETMEZ — o, "iki kulüpten birinde oynamış" demek olurdu ve
        // yalnızca A'da oynayan herkesi de getirirdi.
        AND: [
          { spells: { some: { clubId: query.clubA, ...qualifies } } },
          { spells: { some: { clubId: query.clubB, ...qualifies } } },
        ],
      },
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
