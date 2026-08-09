import { ClubNotFoundError, SameClubError } from "@/domain/errors/domain-error";
import { findDegeneratePair } from "@/domain/services/club-pair-quality";
import { findCommonPlayers as applyRules } from "@/domain/services/common-players";
import {
  DEFAULT_SPELL_FILTER,
  type SpellFilter,
} from "@/domain/services/spell-filter";
import type { ClubId } from "@/domain/value-objects/identifiers";
import {
  toCommonPlayerDto,
  type CommonPlayersResultDto,
} from "../dto/common-players-dto";
import { toClubDto } from "../dto/club-dto";
import type { ClubRepository } from "../ports/club-repository";
import type { PlayerRepository } from "../ports/player-repository";

/**
 * MVP'nin çekirdek senaryosu — PROJECT.md §6.2.
 *
 * Use-case'in işi ORKESTRASYONDUR, iş kuralı barındırmak değil: kuralları
 * `domain/services` uygular, veriyi port'lar getirir, burada yalnızca sıra
 * kurulur ve dış dünyaya dönecek şekil hazırlanır.
 */

export interface FindCommonPlayersInput {
  readonly clubA: ClubId;
  readonly clubB: ClubId;
  readonly filter?: Partial<SpellFilter>;
}

export interface FindCommonPlayersDeps {
  readonly clubs: ClubRepository;
  readonly players: PlayerRepository;
}

export async function findCommonPlayers(
  input: FindCommonPlayersInput,
  deps: FindCommonPlayersDeps,
): Promise<CommonPlayersResultDto> {
  const filter: SpellFilter = { ...DEFAULT_SPELL_FILTER, ...input.filter };

  // BR-4 — aynı kulüp iki kez seçilemez.
  //
  // Denetim veritabanına gitmeden ÖNCE yapılır: geçersiz bir istek için sorgu
  // çalıştırmak gereksiz yük ve boşuna gecikmedir (§7.1).
  if (input.clubA === input.clubB) {
    throw new SameClubError();
  }

  const clubs = await deps.clubs.findByIds([input.clubA, input.clubB]);
  const byId = new Map(clubs.map((club) => [club.id, club]));

  const clubA = byId.get(input.clubA);
  const clubB = byId.get(input.clubB);

  // Hangisinin eksik olduğunu SÖYLEMİYORUZ. Ayrı mesajlar, geçerli kimlikleri
  // deneme yanılmayla ayıklamayı kolaylaştırırdı; burada kazanılan tanı
  // kolaylığı bu maliyete değmez (§6.3).
  if (clubA === undefined || clubB === undefined) {
    throw new ClubNotFoundError();
  }

  const candidates = await deps.players.findCommonPlayers({
    clubA: input.clubA,
    clubB: input.clubB,
    filter,
  });

  // BR-1 ve BR-5 burada uygulanır — port ne döndürürse döndürsün.
  const common = applyRules({
    clubA: input.clubA,
    clubB: input.clubB,
    candidates,
    filter,
  });

  return {
    clubA: toClubDto(clubA),
    clubB: toClubDto(clubB),
    count: common.length,
    players: common.map(toCommonPlayerDto),
    // BR-36 — kuralın girdisi BR-1'in ÇIKTISIDIR, ayrı bir sayım değil.
    // Ayrı sorgu atmak, ekranda görünen listeyle uyarıdaki sayının
    // ayrışabileceği ikinci bir yol açardı (BR-16'nın ölçülmüş hata sınıfı).
    degenerate: findDegeneratePair({
      clubA,
      clubB,
      sharedPlayers: common.length,
    }),
  };
}
