import type { ClubId, PlayerId } from "../value-objects/identifiers";

/**
 * 3×3 ızgara modu — PROJECT.md §9.1.
 *
 * Bu dosya saf kuraldır: veri erişimi, rastgelelik kaynağı ve sunum burada
 * YOKTUR. Üretim `application/game-modes/` içinde, veri `infrastructure`
 * içinde yaşar (§2.1).
 */

/** Izgaranın kenar uzunluğu. Ad "3×3" olsa da sayı tek yerde tutulur. */
export const GRID_SIZE = 3;

/**
 * Bir hücrede bulunması gereken asgari cevap sayısı (BR-9).
 *
 * Ölçüldü (§9.1): 5 alt sınırıyla 150 tohumun 150'si geçerli ızgara üretiyor
 * ve hücre başına medyan 24 cevap çıkıyor. Daha düşük bir eşik ızgarayı
 * kolaylaştırmaz, TAHMİN EDİLEMEZ kılar: tek cevabı olan bir hücre bilgi
 * değil şans sorar.
 */
export const MIN_CELL_ANSWERS = 5;

/**
 * Bir hücredeki azami cevap sayısı (BR-9).
 *
 * Üst sınır da gereklidir: "Bayern'de oynamış bir Alman" hücresinin 518
 * cevabı var ve bu bir soru değil, bedava bir kutudur.
 */
export const MAX_CELL_ANSWERS = 150;

/** Kriter: ya bir kulüpte oynamış olmak, ya bir ülkenin vatandaşı olmak. */
export type GridCriterion =
  | { readonly type: "club"; readonly clubId: ClubId; readonly label: string }
  | {
      readonly type: "nationality";
      readonly code: string;
      readonly label: string;
    };

/** İki kriterin aynı şeyi sorup sormadığı — aynı eksende tekrar olmamalı. */
export function isSameCriterion(a: GridCriterion, b: GridCriterion): boolean {
  if (a.type !== b.type) return false;
  return a.type === "club" && b.type === "club"
    ? a.clubId === b.clubId
    : a.type === "nationality" && b.type === "nationality"
      ? a.code === b.code
      : false;
}

export interface Grid {
  readonly rows: readonly GridCriterion[];
  readonly columns: readonly GridCriterion[];
}

/**
 * BR-9 — hücre, alt ve üst sınırın ARASINDA mı?
 *
 * Girdi bir sayı, küme değil: kural "kaç cevap var" sorusuna bakar ve bu,
 * kesişimi kimin nasıl hesapladığından bağımsızdır.
 */
export function isCellPlayable(answerCount: number): boolean {
  return answerCount >= MIN_CELL_ANSWERS && answerCount <= MAX_CELL_ANSWERS;
}

/** Bir eksende aynı kriter iki kez geçmemeli. */
export function hasDistinctCriteria(axis: readonly GridCriterion[]): boolean {
  return axis.every(
    (criterion, index) =>
      !axis.some((other, j) => j < index && isSameCriterion(criterion, other)),
  );
}

/**
 * Izgara yapısal olarak geçerli mi? (hücre sayımları HARİÇ)
 *
 * Satır ve sütunlar ayrı ayrı tekrarsız olmalı ve bir kriter hem satırda hem
 * sütunda bulunmamalıdır — "Barcelona × Barcelona" hücresi bir soru değildir.
 */
export function isGridShapeValid(grid: Grid): boolean {
  if (grid.rows.length !== GRID_SIZE) return false;
  if (grid.columns.length !== GRID_SIZE) return false;
  if (!hasDistinctCriteria(grid.rows)) return false;
  if (!hasDistinctCriteria(grid.columns)) return false;

  return !grid.rows.some((row) =>
    grid.columns.some((column) => isSameCriterion(row, column)),
  );
}

/** Bir hücrenin kimliği — kullanıcı cevabı bununla eşlenir. */
export interface CellRef {
  readonly row: number;
  readonly column: number;
}

export function isCellRefInRange(cell: CellRef): boolean {
  return (
    Number.isInteger(cell.row) &&
    Number.isInteger(cell.column) &&
    cell.row >= 0 &&
    cell.row < GRID_SIZE &&
    cell.column >= 0 &&
    cell.column < GRID_SIZE
  );
}

/**
 * BR-10 — bir oyuncu ızgarada yalnızca BİR hücrede kullanılabilir.
 *
 * Kural olmasaydı üç kulüpte de oynamış tek bir oyuncu satırın tamamını
 * doldururdu; ızgaranın sorduğu şey tam olarak bu değil.
 */
export function isPlayerAlreadyUsed(
  used: ReadonlyMap<string, PlayerId>,
  playerId: PlayerId,
  target: CellRef,
): boolean {
  const targetKey = cellKey(target);
  for (const [key, existing] of used) {
    if (key !== targetKey && existing === playerId) return true;
  }
  return false;
}

export function cellKey(cell: CellRef): string {
  return `${String(cell.row)}:${String(cell.column)}`;
}
