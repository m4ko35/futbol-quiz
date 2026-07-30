import type { Spell } from "@/domain/entities/spell";
import type { CommonPlayer } from "@/domain/services/common-players";
import type { ClubDto } from "./club-dto";

/** Dışarı dönen ortak oyuncu şekilleri — PROJECT.md §6.2. */

export interface SpellDto {
  readonly startYear: number | null;
  readonly endYear: number | null;
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
 * et" seçeneğini açtığında bu alan anlam kazanır ve arayüz ihtiyacı
 * belirginleştiğinde eklenir — şimdi eklemek, kullanılmayan bir alanı
 * sözleşmeye sokmak olurdu.
 *
 * `isCurrent` de yanıta ÇIKMAZ ve sebebi ölçülmüştür. Alan, Wikidata'da
 * "bitiş tarihi yok" durumundan türetiliyor; ama bu "hâlâ kulüpte" değil,
 * **"bitişi kimse girmemiş"** demek. Ölçüm:
 *
 *   Man United "güncel kadro" → Herbert Broomfield (1909), Harold Hardman (1912)
 *   Bayern     "güncel kadro" → Paul Francke (1899), Kuno Friederich (1899)
 *
 * 32.102 dönemde bitiş tarihi eksik. Yanlış olduğu ölçülmüş bir alanı dışarı
 * vermek, onu tüketen herkes için tuzaktır (§2.7: belirsizlik veri kaybından
 * iyidir). Ham bayrak veritabanında duruyor; güvenilir bir "güncel kadro"
 * kaynağı eklenirse yeniden değerlendirilir (§10.2).
 */
export function toSpellDto(spell: Spell): SpellDto {
  return {
    startYear: spell.years.start,
    endYear: spell.years.end,
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
