import type { Club } from "@/domain/entities/club";
import type { Player } from "@/domain/entities/player";
import type { Spell } from "@/domain/entities/spell";
import { clubId, playerId } from "@/domain/value-objects/identifiers";

/**
 * Test veri kurucuları.
 *
 * NEDEN: bir testin okunabilirliği, ilgisiz alanların gürültüsüne ters
 * orantılıdır. `spell({ clubId: "A", isLoan: true })` yazan bir test neyi
 * denediğini tek satırda söyler; on alanı elle dolduran test söylemez.
 * Belirtilmeyen her alan makul bir varsayılan alır.
 */

let sequence = 0;

/** Her çağrıda benzersiz ama okunabilir kimlik: "p1", "p2"… */
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}${sequence}`;
}

export function aClub(overrides: Partial<Club> = {}): Club {
  return {
    id: clubId(nextId("club")),
    name: "Test Kulübü",
    shortName: "Test",
    country: "TR",
    foundedYear: 1900,
    crestUrl: null,
    isSelectable: true,
    ...overrides,
  };
}

export function aPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: playerId(nextId("player")),
    name: "Test Oyuncu",
    nationality: "TR",
    position: "Orta saha",
    ...overrides,
  };
}

export function aSpell(overrides: Partial<Spell> = {}): Spell {
  return {
    playerId: playerId(nextId("player")),
    clubId: clubId(nextId("club")),
    years: { start: 2010, end: 2012 },
    isCurrent: false,
    isLoan: false,
    isYouth: false,
    appearances: null,
    goals: null,
    ...overrides,
  };
}
