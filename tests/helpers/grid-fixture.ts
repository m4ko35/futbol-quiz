import type { GridDeps } from "@/application/game-modes/grid/generate";
import { CURATED_CLUB_QIDS } from "@/application/curated-clubs";
import type { PlayerSpells } from "@/domain/services/common-players";
import type { GridCriterion } from "@/domain/services/grid";
import { MIN_CELL_ANSWERS } from "@/domain/services/grid";
import { clubId, type PlayerId } from "@/domain/value-objects/identifiers";
import { aClub, aPlayer, aSpell } from "./builders";
import { FakeClubRepository, FakePlayerRepository } from "./fake-repositories";

/**
 * Izgara üretimi için sentetik veri kümesi.
 *
 * NEDEN GERÇEK VERİTABANI DEĞİL: üretim algoritmasının doğruluğu veriye değil
 * KURALA bağlıdır. Sentetik küme, hangi hücrede kaç cevap olduğunu tam olarak
 * bilmemizi sağlar; gerçek veriyle "365/365 üretilebiliyor" ölçümü ayrıca
 * yapıldı ve o bir ölçüm, bir test değil (§9.1).
 *
 * KURULUM: havuzun ilk `CLUB_COUNT` kulübü alınır ve her kulüp ÇİFTİ için tam
 * `PER_PAIR` ortak oyuncu üretilir. Böylece her kulüp×kulüp hücresinin cevap
 * sayısı bilinir ve BR-9 bandının içindedir.
 */

/** Üretim en az `GRID_SIZE + 1` kulüp ister; altı, seçim yapılabilecek kadar. */
const CLUB_COUNT = 6;

/** Alt sınırın hemen üstü: band ihlali olursa test bunu yakalasın. */
const PER_PAIR = MIN_CELL_ANSWERS + 1;

export interface GridFixture {
  readonly deps: GridDeps;
  /** Havuz QID'i = kulüp kimliği (fake bu eşlemeyi kullanır). */
  readonly clubIds: readonly string[];
  /** `findIdsMatching` kaç kez çağrıldı — önbellek testleri için. */
  callCount(): number;
  /** İki kulüpte de oynamış bir oyuncunun kimliği. */
  playerAtBoth(a: string, b: string): string;
}

class CountingPlayerRepository extends FakePlayerRepository {
  calls = 0;

  override findIdsMatching(criterion: GridCriterion): Promise<PlayerId[]> {
    this.calls += 1;
    return super.findIdsMatching(criterion);
  }
}

export function gridFixture(): GridFixture {
  const clubIds = CURATED_CLUB_QIDS.slice(0, CLUB_COUNT);
  const clubs = clubIds.map((qid) =>
    // Fake depo QID'yi kulübün kimliği sayar; kısa ad da ondan türetilir ki
    // etiketler testte okunabilir olsun.
    aClub({ id: clubId(qid), shortName: `Kulüp ${qid}` }),
  );

  const candidates: PlayerSpells[] = [];
  const byPair = new Map<string, string[]>();

  for (let i = 0; i < clubIds.length; i++) {
    for (let j = i + 1; j < clubIds.length; j++) {
      const a = clubIds[i];
      const b = clubIds[j];
      if (a === undefined || b === undefined) continue;

      const ids: string[] = [];
      for (let n = 0; n < PER_PAIR; n++) {
        const player = aPlayer({
          name: `Oyuncu ${a}-${b}-${String(n)}`,
          // Uyruk kasten havuz dışında: satırların KULÜP olduğu bir ızgara
          // kurulsun ki beklenen sonuç tek anlamlı olsun.
          nationality: "ZZ",
        });
        candidates.push({
          player,
          spells: [
            aSpell({ playerId: player.id, clubId: clubId(a) }),
            aSpell({ playerId: player.id, clubId: clubId(b) }),
          ],
        });
        ids.push(player.id);
      }
      byPair.set(pairKey(a, b), ids);
    }
  }

  const players = new CountingPlayerRepository(candidates);

  return {
    deps: { clubs: new FakeClubRepository(clubs), players },
    clubIds,
    callCount: () => players.calls,
    playerAtBoth(a, b) {
      const ids = byPair.get(pairKey(a, b));
      if (ids === undefined || ids[0] === undefined) {
        throw new Error(`Bu çift için oyuncu üretilmedi: ${a}, ${b}`);
      }
      return ids[0];
    },
  };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
