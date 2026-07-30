import {
  isCellPlayable,
  isGridShapeValid,
  isSameCriterion,
  GRID_SIZE,
  type Grid,
  type GridCriterion,
} from "@/domain/services/grid";
import {
  createRandom,
  seedVariant,
  shuffled,
} from "@/domain/value-objects/daily-seed";
import type { ClubRepository } from "../../ports/club-repository";
import type { PlayerRepository } from "../../ports/player-repository";
import {
  GRID_CLUB_QIDS,
  GRID_NATIONALITY_CODES,
  NATIONALITY_LABELS,
} from "./pool";

/**
 * Günlük ızgara üretimi — PROJECT.md §9.1.
 *
 * ALGORİTMA. Önce üç sütun (kulüp) seçilir, sonra üç sütunun HEPSİYLE
 * oynanabilir kesişimi olan üç satır aranır. Ters sıra — önce satırlar —
 * daha çok başarısız denemeye yol açıyordu: sütunlar seçilmeden bir satırın
 * uygunluğu bilinemez.
 *
 * KESİŞİMLER BELLEKTE. Her kriter için oyuncu kimlik kümesi bir kez çekilir,
 * dokuz hücre bellekte kesiştirilir. Hücre başına ayrı sorgu atmak, deneme
 * başına dokuz gidiş-dönüş demekti; aynı tercih ortak oyuncu sorgusunda
 * ölçülerek doğrulanmıştı (p95 47,7 → 16,8 ms).
 *
 * ÖLÇÜM (gerçek veri, 365 gün): 365/365 geçerli ızgara, ortalama 1,1 deneme,
 * ızgara başına 2,9 ms, %73'ünde ülke satırı, hücre başına medyan 9 cevap.
 */

/** Bir günün ızgarası kaç farklı tohumla denenir. */
const MAX_ATTEMPTS = 40;

/** Bir denemede kaç satır adayı yoklanır. */
const MAX_ROW_PROBES = 200;

export interface GridDeps {
  readonly clubs: ClubRepository;
  readonly players: PlayerRepository;
}

export async function generateGrid(
  seed: number,
  deps: GridDeps,
): Promise<Grid | null> {
  const clubs = await deps.clubs.findByWikidataIds(GRID_CLUB_QIDS);

  const clubCriteria: GridCriterion[] = clubs.map((club) => ({
    type: "club",
    clubId: club.id,
    label: club.shortName,
  }));
  const nationalityCriteria: GridCriterion[] = GRID_NATIONALITY_CODES.map(
    (code) => ({
      type: "nationality",
      code,
      label: NATIONALITY_LABELS[code] ?? code,
    }),
  );

  // Havuz beklenmedik biçimde küçükse ızgara kurulamaz; sessizce bozuk bir
  // ızgara üretmektense `null` dönmek doğrudur (§2.7).
  if (clubCriteria.length < GRID_SIZE + 1) return null;

  const rowPool = [...clubCriteria, ...nationalityCriteria];

  // Aynı kriterin kümesi bir üretim boyunca birden çok kez istenebilir;
  // tekrar sorgu atmamak için hafızada tutulur.
  const sets = new Map<string, Set<string>>();
  const setOf = async (criterion: GridCriterion): Promise<Set<string>> => {
    const key = criterionKey(criterion);
    const cached = sets.get(key);
    if (cached !== undefined) return cached;

    const ids = await deps.players.findIdsMatching(criterion);
    const set = new Set<string>(ids);
    sets.set(key, set);
    return set;
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const random = createRandom(seedVariant(seed, attempt));

    const columns = shuffled(clubCriteria, random).slice(0, GRID_SIZE);
    const columnSets = await Promise.all(columns.map(setOf));

    const rows: GridCriterion[] = [];
    const candidates = shuffled(rowPool, random);

    for (const candidate of candidates.slice(0, MAX_ROW_PROBES)) {
      if (rows.length === GRID_SIZE) break;
      if (rows.some((row) => isSameCriterion(row, candidate))) continue;
      if (columns.some((column) => isSameCriterion(column, candidate))) continue;

      const candidateSet = await setOf(candidate);
      const playable = columnSets.every((columnSet) =>
        isCellPlayable(intersectionSize(candidateSet, columnSet)),
      );
      if (playable) rows.push(candidate);
    }

    if (rows.length === GRID_SIZE) {
      const grid: Grid = { rows, columns };
      // Kural domain'de; burada yalnızca DOĞRULANIR. Üretim mantığındaki bir
      // hata sessizce geçersiz ızgara üretmesin.
      if (isGridShapeValid(grid)) return grid;
    }
  }

  return null;
}

function criterionKey(criterion: GridCriterion): string {
  return criterion.type === "club"
    ? `club:${criterion.clubId}`
    : `nat:${criterion.code}`;
}

/** Küçük kümeyi tarayıp büyükte aramak, tersinden ucuzdur. */
function intersectionSize(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let count = 0;
  for (const id of small) if (large.has(id)) count++;
  return count;
}
