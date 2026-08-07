import type {
  ClubRepository,
  ClubSearchQuery,
} from "@/application/ports/club-repository";
import type {
  CommonPlayersQuery,
  PlayerRepository,
  PlayerSearchQuery,
} from "@/application/ports/player-repository";
import type {
  StatMatchRepository,
  StatMatchTarget,
} from "@/application/ports/stat-match-repository";
import type { Club } from "@/domain/entities/club";
import type { Player } from "@/domain/entities/player";
import type { StatKey } from "@/domain/services/stat-match";
import type { PlayerSpells } from "@/domain/services/common-players";
import type { GridCriterion } from "@/domain/services/grid";
import { spellQualifies } from "@/domain/services/spell-filter";
import { toSearchKey } from "@/domain/value-objects/search-key";
import type { ClubId, PlayerId } from "@/domain/value-objects/identifiers";

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

  /**
   * Fake, QID'yi kulübün `id`'si sayar.
   *
   * Domain `Club` varlığı `wikidataId` taşımaz (dış kaynak kimliği bir domain
   * kavramı değil, §5.1). Testler kimlikleri kendileri belirlediği için bu
   * eşleme yeterli; gerçek eşlemenin doğruluğu entegrasyon testlerinde
   * ölçülür.
   */
  findByWikidataIds(wikidataIds: readonly string[]): Promise<Club[]> {
    const wanted = new Set(wikidataIds);
    return Promise.resolve(
      this.#clubs.filter((club) => club.isSelectable && wanted.has(club.id)),
    );
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

  /** §9.1 — kriteri sağlayan oyuncu kimlikleri. */
  findIdsMatching(criterion: GridCriterion): Promise<PlayerId[]> {
    const ids = this.#candidates
      .filter((candidate) =>
        criterion.type === "club"
          ? candidate.spells.some(
              (spell) => spell.clubId === criterion.clubId && !spell.isYouth,
            )
          : candidate.player.nationality === criterion.code,
      )
      .map((candidate) => candidate.player.id);

    return Promise.resolve([...new Set(ids)]);
  }

  /** BR-12 — kimlikle doğrulama. */
  matchesAll(
    id: PlayerId,
    criteria: readonly GridCriterion[],
  ): Promise<boolean> {
    if (criteria.length === 0) return Promise.resolve(false);

    const candidate = this.#candidates.find((c) => c.player.id === id);
    if (candidate === undefined) return Promise.resolve(false);

    return Promise.resolve(
      criteria.every((criterion) =>
        criterion.type === "club"
          ? candidate.spells.some(
              (spell) => spell.clubId === criterion.clubId && !spell.isYouth,
            )
          : candidate.player.nationality === criterion.code,
      ),
    );
  }

  search(query: PlayerSearchQuery): Promise<Player[]> {
    const term = toSearchKey(query.term);
    if (term.length === 0) return Promise.resolve([]);

    return Promise.resolve(
      this.#candidates
        .map((candidate) => candidate.player)
        .filter((player) => toSearchKey(player.name).includes(term))
        .slice(0, query.limit),
    );
  }
}

/**
 * §9.2 — istatistik eşleştirme deposunun bellek içi uygulaması.
 *
 * Aday listesi VERİLDİĞİ SIRADA döner: port sözleşmesi kararlı sıra ister
 * (BR-19) ve testin hangi oyuncunun seçileceğini bilebilmesi buna bağlı.
 */
export class FakeStatMatchRepository implements StatMatchRepository {
  readonly #candidates: StatMatchTarget[];
  readonly #choosable: StatMatchTarget[];

  /**
   * @param candidates günün oyuncusu adayları — tanınırlık süzgecini geçmiş
   *   olanlar (BR-19).
   * @param choosable "Sen seç" hedefi olabilecekler (BR-24). Verilmezse
   *   adayların kendisi kullanılır; iki havuzun ÜRETİMDE farklı olduğunu
   *   (1.927'ye karşı 5.524) sınayan testler bunu açıkça geçirir.
   */
  constructor(
    candidates: readonly StatMatchTarget[] = [],
    choosable?: readonly StatMatchTarget[],
  ) {
    this.#candidates = [...candidates];
    this.#choosable = [...(choosable ?? candidates)];
  }

  findDailyCandidates(): Promise<readonly StatMatchTarget[]> {
    return Promise.resolve(this.#candidates);
  }

  /** BR-24 — havuzda yoksa null; sessizce başka oyuncuya kaydırılmaz. */
  findChosenTarget(id: string): Promise<StatMatchTarget | null> {
    return Promise.resolve(this.#choosable.find((c) => c.id === id) ?? null);
  }

  /**
   * Her iki havuzdaki oyuncular kendi değerlerini verir; hiçbirinde olmayan
   * oyuncu `null` döner — BR-16'nın "verisi yok" durumu.
   */
  findStatValue(id: string, key: StatKey): Promise<number | null> {
    const player =
      this.#candidates.find((c) => c.id === id) ??
      this.#choosable.find((c) => c.id === id);
    return Promise.resolve(player?.stats[key] ?? null);
  }
}
