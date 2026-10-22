import {
  isCellPlayable,
  isGridShapeValid,
  isSameCriterion,
  GRID_SIZE,
  type Grid,
  type GridCriterion,
  type GridSize,
} from "@/domain/services/grid";
import {
  createRandom,
  seedVariant,
  shuffled,
} from "@/domain/value-objects/daily-seed";
import { countryName } from "@/lib/country-name";
import type { ClubRepository } from "../../ports/club-repository";
import type { PlayerRepository } from "../../ports/player-repository";
import { CURATED_CLUB_QIDS } from "../../curated-clubs";
import { GRID_NATIONALITY_CODES } from "./pool";

/**
 * Izgara üretimi — PROJECT.md §9.1.
 *
 * İKİ ÇAĞIRAN, TEK ALGORİTMA. Günlük ızgara bunu günün tohumuyla ve sabit
 * `GRID_SIZE` ile çağırır (BR-11); "Rastgele ızgara" (BR-77) rastgele bir
 * tohumla ve kullanıcının seçtiği boyutla çağırır (BR-27). Boyut bir
 * PARAMETREDİR, varsayılanı günlük ızgaranın boyutudur — eski çağrı aynen
 * çalışır, yeni çağıran boyutu kendisi verir.
 *
 * ALGORİTMA. Önce `size` sütun (kulüp) seçilir, sonra bu sütunların HEPSİYLE
 * oynanabilir kesişimi olan `size` satır aranır. Ters sıra — önce satırlar —
 * daha çok başarısız denemeye yol açıyordu: sütunlar seçilmeden bir satırın
 * uygunluğu bilinemez.
 *
 * KESİŞİMLER BELLEKTE. Her kriter için oyuncu kimlik kümesi bir kez çekilir,
 * dokuz hücre bellekte kesiştirilir. Hücre başına ayrı sorgu atmak, deneme
 * başına dokuz gidiş-dönüş demekti; aynı tercih ortak oyuncu sorgusunda
 * ölçülerek doğrulanmıştı (p95 47,7 → 16,8 ms).
 *
 * ÖLÇÜM (39 kulüplük küratörlü havuz, gerçek veri, gerçek depolar, 365 gün —
 * `npm run measure:grid`): 365/365 geçerli ızgara · 39 kulübün hepsi en az 22
 * kez çıktı · ızgara başına ~311 ms. Hücre cevap sayısı BR-9 ile band içinde
 * (≥5, ≤150) kalır; bu band pool boyutundan bağımsızdır.
 *
 * ~311 ms'yi günün İLK isteği öder; sonuç `daily-grid.ts` içinde gün anahtarıyla
 * önbelleklenir. Maliyet kriter başına ayrı kimlik sorgusundan gelir. (Havuz
 * 2026-10-22'de 82→39 kulübe indirildi; ölçüm o gün yeniden koşuldu.)
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
  size: GridSize = GRID_SIZE,
): Promise<Grid | null> {
  const clubs = await deps.clubs.findByWikidataIds(CURATED_CLUB_QIDS);

  const clubCriteria: GridCriterion[] = clubs.map((club) => ({
    type: "club",
    clubId: club.id,
    label: club.shortName,
  }));
  const nationalityCriteria: GridCriterion[] = GRID_NATIONALITY_CODES.map(
    (code) => ({
      type: "nationality",
      code,
      label: countryName(code),
    }),
  );

  // Havuz beklenmedik biçimde küçükse ızgara kurulamaz; sessizce bozuk bir
  // ızgara üretmektense `null` dönmek doğrudur (§2.7). `size` sütunun hepsi
  // ayrı kulüp, en az bir satır da ayrı bir kulüp olabilsin diye `size + 1`.
  if (clubCriteria.length < size + 1) return null;

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

    const columns = shuffled(clubCriteria, random).slice(0, size);
    const columnSets = await Promise.all(columns.map(setOf));

    const rows: GridCriterion[] = [];
    const candidates = shuffled(rowPool, random);

    for (const candidate of candidates.slice(0, MAX_ROW_PROBES)) {
      if (rows.length === size) break;
      if (rows.some((row) => isSameCriterion(row, candidate))) continue;
      if (columns.some((column) => isSameCriterion(column, candidate)))
        continue;

      const candidateSet = await setOf(candidate);
      const playable = columnSets.every((columnSet) =>
        isCellPlayable(intersectionSize(candidateSet, columnSet)),
      );
      if (playable) rows.push(candidate);
    }

    if (rows.length === size) {
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
