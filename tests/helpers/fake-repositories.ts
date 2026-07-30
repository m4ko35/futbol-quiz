import type {
  ClubRepository,
  ClubSearchQuery,
} from "@/application/ports/club-repository";
import type {
  CommonPlayersQuery,
  PlayerRepository,
} from "@/application/ports/player-repository";
import type { Club } from "@/domain/entities/club";
import type { PlayerSpells } from "@/domain/services/common-players";
import { spellQualifies } from "@/domain/services/spell-filter";
import { toSearchKey } from "@/domain/value-objects/search-key";
import type { ClubId } from "@/domain/value-objects/identifiers";

/**
 * Port'ların bellek içi uygulamaları.
 *
 * NEDEN sahte (fake) kullanıyoruz, sahte-nesne (mock) değil: mock, "şu metot
 * şu argümanla çağrıldı mı" diye sorar ve testi uygulamanın İÇ yapısına
 * bağlar. Fake ise port sözleşmesini gerçekten yerine getirir; test, use-case
 * neyi nasıl çağırdığına değil NE ÜRETTİĞİNE bakar. Böylece use-case içi
 * yeniden düzenlemeler testleri kırmaz.
 *
 * Bu fake'ler kasıtlı olarak Prisma uygulamasıyla AYNI sözleşmeyi izler;
 * sözleşmenin gerçek veritabanında da geçerli olduğu tests/integration
 * altında ayrıca ölçülür.
 */

export class FakeClubRepository implements ClubRepository {
  readonly #clubs: Club[];

  constructor(clubs: readonly Club[]) {
    this.#clubs = [...clubs];
  }

  search(query: ClubSearchQuery): Promise<Club[]> {
    const term = query.term === null ? null : toSearchKey(query.term);

    const matched = this.#clubs
      .filter((club) => club.isSelectable)
      .filter((club) => term === null || toSearchKey(club.name).includes(term))
      .sort((a, b) => a.shortName.localeCompare(b.shortName, "tr"))
      .slice(0, query.limit);

    return Promise.resolve(matched);
  }

  findByIds(ids: readonly ClubId[]): Promise<Club[]> {
    const wanted = new Set<string>(ids);
    return Promise.resolve(this.#clubs.filter((club) => wanted.has(club.id)));
  }
}

export class FakePlayerRepository implements PlayerRepository {
  readonly #candidates: PlayerSpells[];

  constructor(candidates: readonly PlayerSpells[]) {
    this.#candidates = [...candidates];
  }

  findCommonPlayers(query: CommonPlayersQuery): Promise<PlayerSpells[]> {
    const result: PlayerSpells[] = [];

    for (const candidate of this.#candidates) {
      // Port sözleşmesinin 2. ve 3. maddesi: yalnızca iki kulübün, yalnızca
      // filtreden geçen dönemleri.
      const spells = candidate.spells.filter(
        (spell) =>
          (spell.clubId === query.clubA || spell.clubId === query.clubB) &&
          spellQualifies(spell, query.filter),
      );

      // 1. madde: her iki kulüpte de en az bir dönem.
      const atA = spells.some((spell) => spell.clubId === query.clubA);
      const atB = spells.some((spell) => spell.clubId === query.clubB);
      if (!atA || !atB) continue;

      result.push({ player: candidate.player, spells });
    }

    return Promise.resolve(result);
  }
}
