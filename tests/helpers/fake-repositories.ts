import type {
  ClubRepository,
  ClubSearchQuery,
  CrestCredit,
} from "@/application/ports/club-repository";
import type {
  CommonPlayersQuery,
  PlayableCriteriaQuery,
  PlayerRepository,
  PlayerSearchQuery,
} from "@/application/ports/player-repository";
import type {
  StatMatchRepository,
  StatMatchTarget,
} from "@/application/ports/stat-match-repository";
import type {
  WhichMoreCandidate,
  WhichMoreCandidateQuery,
  WhichMoreRepository,
} from "@/application/ports/which-more-repository";
import { MIN_GAP } from "@/domain/services/which-more";
import type { Club } from "@/domain/entities/club";
import type { Player } from "@/domain/entities/player";
import type { StatKey } from "@/domain/services/stat-match";
import type { PlayerSpells } from "@/domain/services/common-players";
import {
  isCellPlayable,
  isSameCriterion,
  type GridCriterion,
} from "@/domain/services/grid";
import { spellQualifies } from "@/domain/services/spell-filter";
import { toSearchKey } from "@/domain/value-objects/search-key";
import { countryName } from "@/lib/country-name";
import {
  clubId,
  type ClubId,
  type PlayerId,
} from "@/domain/value-objects/identifiers";

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

  /**
   * §7.3 — atıf künyeleri. Fake, künyeyi kulüp nesnesinde taşımadığı için boş
   * döner; sözleşmenin gerçek veriyle davranışı bütünleşme testinde ölçülüyor.
   */
  listCrestCredits(): Promise<readonly CrestCredit[]> {
    return Promise.resolve(this.#credits);
  }

  /** Testler künye listesini açıkça verebilir. */
  withCredits(credits: readonly CrestCredit[]): this {
    this.#credits = credits;
    return this;
  }

  #credits: readonly CrestCredit[] = [];
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

  /**
   * BR-25 — bir eksene konabilecek ölçütler.
   *
   * Gerçek depo bandı SQL'de uyguluyor; burada aynı kural domain
   * fonksiyonuyla (`isCellPlayable`) uygulanıyor. İKİSİNİN AYNI SORUYU
   * SORMASI şart: bu fake, use-case testlerinin gördüğü tek "veritabanı".
   *
   * Kulüp etiketi olarak kimliğin kendisi kullanılır — fake'te kulüp adı
   * yoktur (`PlayerSpells` yalnızca dönem taşır) ve testler kimlikle
   * doğrulama yapar.
   */
  findPlayableCriteria(query: PlayableCriteriaQuery): Promise<GridCriterion[]> {
    if (query.against.length === 0) return Promise.resolve([]);

    const universe: GridCriterion[] = [
      ...new Set(
        this.#candidates.flatMap((candidate) =>
          candidate.spells
            .filter((spell) => !spell.isYouth)
            .map((spell) => String(spell.clubId)),
        ),
      ),
    ].map((id) => ({ type: "club", clubId: clubId(id), label: id }));

    for (const code of new Set(
      this.#candidates.flatMap((candidate) =>
        candidate.player.nationality === null
          ? []
          : [candidate.player.nationality],
      ),
    )) {
      universe.push({ type: "nationality", code, label: countryName(code) });
    }

    const matches = (candidate: PlayerSpells, criterion: GridCriterion) =>
      criterion.type === "club"
        ? candidate.spells.some(
            (spell) => spell.clubId === criterion.clubId && !spell.isYouth,
          )
        : candidate.player.nationality === criterion.code;

    const term = query.term === null ? null : toSearchKey(query.term);

    const playable = universe.filter((aday) => {
      if (query.against.some((one) => isSameCriterion(one, aday))) return false;
      if (term !== null && !toSearchKey(aday.label).includes(term))
        return false;

      return query.against.every((one) =>
        isCellPlayable(
          this.#candidates.filter(
            (candidate) => matches(candidate, one) && matches(candidate, aday),
          ).length,
        ),
      );
    });

    return Promise.resolve(playable.slice(0, query.limit));
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

/** Havuzdaki bir oyuncu — testler yalnızca sorulan istatistiği vermek zorunda. */
export interface FakeWhichMorePlayer {
  readonly id: string;
  readonly name: string;
  readonly clubs?: readonly string[];
  readonly values: Partial<Record<StatKey, number>>;
}

/**
 * §9.3 — "Hangisi daha" deposunun bellek içi uygulaması.
 *
 * PORT SÖZLEŞMESİNİ GERÇEKTEN UYGULAR: BR-29 bandı, BR-30'un taraf seçimi ve
 * dışlama listesi burada da geçerlidir. Sözleşmeyi çiğneyen bir fake, use-case
 * testlerini yeşil gösterip üretimde patlayan bir kural boşluğu bırakırdı.
 *
 * SEÇİM RASTGELE DEĞİL, sıradaki İLK uygun adaydır. Rastgelelik testin
 * beklentisini yazılamaz kılardı; dengelemenin doğruluğu domain testinde,
 * gerçek dağılım ise §9.3'ün benzetimiyle ölçülüyor.
 */
export class FakeWhichMoreRepository implements WhichMoreRepository {
  readonly #players: readonly FakeWhichMorePlayer[];

  constructor(players: readonly FakeWhichMorePlayer[] = []) {
    this.#players = players;
  }

  findCandidate(
    query: WhichMoreCandidateQuery,
  ): Promise<WhichMoreCandidate | null> {
    const excluded = new Set<string>(query.exclude);
    const gap = MIN_GAP[query.statKey];

    const match = this.#players.find((one) => {
      if (excluded.has(one.id)) return false;

      const value = one.values[query.statKey];
      if (value === undefined) return false;
      if (query.threshold === null) return true;

      if (Math.abs(value - query.threshold) < gap) return false;
      if (query.side === "above") return value > query.threshold;
      if (query.side === "below") return value < query.threshold;
      return true;
    });

    return Promise.resolve(
      match === undefined ? null : this.#toCandidate(match, query.statKey),
    );
  }

  findPlayer(
    id: PlayerId,
    statKey: StatKey,
  ): Promise<WhichMoreCandidate | null> {
    const found = this.#players.find((one) => one.id === id);
    if (found === undefined || found.values[statKey] === undefined) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.#toCandidate(found, statKey));
  }

  #toCandidate(
    player: FakeWhichMorePlayer,
    statKey: StatKey,
  ): WhichMoreCandidate {
    return {
      id: player.id as PlayerId,
      name: player.name,
      clubs: player.clubs ?? [],
      value: player.values[statKey] ?? 0,
    };
  }
}
