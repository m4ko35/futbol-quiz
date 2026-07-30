import type { Spell } from "@/domain/entities/spell";
import type { CommonPlayer } from "@/domain/services/common-players";
import type { ClubDto } from "./club-dto";

/** Dışarı dönen ortak oyuncu şekilleri — PROJECT.md §6.2. */

export interface SpellDto {
  readonly startYear: number | null;
  readonly endYear: number | null;
  readonly isCurrent: boolean;
  readonly isLoan: boolean;
  readonly appearances: number | null;
  readonly goals: number | null;
}

export interface CommonPlayerDto {
  readonly id: string;
  readonly name: string;
  readonly nationality: string | null;
  readonly position: string | null;
  readonly spellsAtA: readonly SpellDto[];
  readonly spellsAtB: readonly SpellDto[];
}

export interface CommonPlayersResultDto {
  readonly clubA: ClubDto;
  readonly clubB: ClubDto;
  readonly count: number;
  readonly players: readonly CommonPlayerDto[];
}

/**
 * `isYouth` yanıta ÇIKMAZ.
 *
 * Varsayılan ölçüt altyapı dönemlerini zaten dışarıda bırakır (BR-2); listede
 * görünen her dönem tanım gereği altyapı değildir. Kullanıcı "altyapıyı dahil
 * et" seçeneğini açtığında bu alan anlam kazanır ve Faz 3'te arayüz ihtiyacı
 * belirginleştiğinde eklenir — şimdi eklemek, kullanılmayan bir alanı
 * sözleşmeye sokmak olurdu.
 */
export function toSpellDto(spell: Spell): SpellDto {
  return {
    startYear: spell.years.start,
    endYear: spell.years.end,
    isCurrent: spell.isCurrent,
    isLoan: spell.isLoan,
    appearances: spell.appearances,
    goals: spell.goals,
  };
}

export function toCommonPlayerDto(common: CommonPlayer): CommonPlayerDto {
  return {
    id: common.player.id,
    name: common.player.name,
    nationality: common.player.nationality,
    position: common.player.position,
    spellsAtA: common.spellsAtA.map(toSpellDto),
    spellsAtB: common.spellsAtB.map(toSpellDto),
  };
}
