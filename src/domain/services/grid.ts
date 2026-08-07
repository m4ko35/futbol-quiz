import type { ClubId, PlayerId } from "../value-objects/identifiers";

/**
 * 3×3 ızgara modu — PROJECT.md §9.1.
 *
 * Bu dosya saf kuraldır: veri erişimi, rastgelelik kaynağı ve sunum burada
 * YOKTUR. Üretim `application/game-modes/` içinde, veri `infrastructure`
 * içinde yaşar (§2.1).
 */

/**
 * GÜNLÜK ızgaranın kenar uzunluğu. Ad "3×3" olsa da sayı tek yerde tutulur.
 *
 * Günlük ızgara sabit boyutludur ve öyle kalır (BR-27): herkesin aynı ızgarayı
 * görmesi gerekiyor (BR-11) ve §9.1'in üretilebilirlik ölçümü 3×3 için
 * yapıldı.
 */
export const GRID_SIZE = 3;

/**
 * Kullanıcının kurabileceği boyutlar (BR-27).
 *
 * ÖLÇÜLDÜ (§9.1): boyut büyüdükçe satır adayı azalıyor çünkü aday, seçilen
 * HER sütunla bandda kesişmek zorunda. Rastgele sütunlarla 5×5'in kurulma
 * oranı %21,5'e düşüyor; tanınmış kulüplerle ise 40–79 aday kalıyor. Dördü de
 * sunuluyor, çıkmaza girildiğinde seçici bunu söylüyor.
 */
export const GRID_SIZES = [2, 3, 4, 5] as const;

export type GridSize = (typeof GRID_SIZES)[number];

export function isGridSize(value: number): value is GridSize {
  return (GRID_SIZES as readonly number[]).includes(value);
}

/**
 * Sınırdaki doğrulamalar için üst sınır (§2.3).
 *
 * Listeden TÜRETİLİR, ayrıca yazılmaz: iki yerde iki sayı olsaydı biri
 * güncellenip diğeri unutulduğunda şema, izin verilen bir boyutu reddederdi.
 */
export const MAX_GRID_SIZE = Math.max(...GRID_SIZES);

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
 *
 * BOYUT IZGARANIN KENDİSİNDEN OKUNUR, sabitten değil (BR-27): kullanıcı
 * ızgarası 2×2 ile 5×5 arasında olabilir. Kural değişmedi — kare olma ve
 * tekrarsızlık koşulları her boyutta aynı.
 */
export function isGridShapeValid(grid: Grid): boolean {
  const size = grid.rows.length;
  if (!isGridSize(size)) return false;
  if (grid.columns.length !== size) return false;
  if (!hasDistinctCriteria(grid.rows)) return false;
  if (!hasDistinctCriteria(grid.columns)) return false;

  return !grid.rows.some((row) =>
    grid.columns.some((column) => isSameCriterion(row, column)),
  );
}

/**
 * BR-13 — bir ızgarada toplam tahmin hakkı.
 *
 * Hücre sayısı kadar hak: yanlış bir tahmin bir hücreyi harcar. Sınırsız
 * deneme, ızgarayı bir bilgi sorusundan bir arama alıştırmasına çevirirdi —
 * kullanıcı listeyi tarayıp doğruyu bulana kadar denerdi ve oyunun sorduğu
 * şey ("biliyor musun") ortadan kalkardı.
 *
 * Hücre sayısından TÜRETİLİR, ayrıca yazılmaz: boyut değişince (BR-27) hak
 * sayısı da kendiliğinden değişir. Sabit bir "9" yazılsaydı 5×5 ızgara 25
 * hücreyi 9 hakla sorardı.
 */
export function maxGuesses(size: number): number {
  return size * size;
}

/**
 * Oyun bitti mi? — hak tükendi ya da bütün hücreler çözüldü.
 *
 * NEDEN DOMAIN'DE: arayüz bu koşulu kendi hesaplasaydı, "bitti" tanımı bir
 * bileşenin içinde saklı kalırdı; skor tablosu (§9) eklendiğinde sunucunun da
 * aynı tanıma ihtiyacı olacak.
 *
 * BOYUT AÇIKÇA VERİLİR, varsayılanı YOKTUR: unutulan bir argüman sessizce
 * "3×3" anlamına gelseydi, 5×5 ızgara dokuzuncu hücrede biterdi.
 */
export function isGameOver(
  guessesUsed: number,
  solvedCells: number,
  size: number,
): boolean {
  return guessesUsed >= maxGuesses(size) || solvedCells >= maxGuesses(size);
}

/** Bir hücrenin kimliği — kullanıcı cevabı bununla eşlenir. */
export interface CellRef {
  readonly row: number;
  readonly column: number;
}

/**
 * GÜNLÜK ızgaranın hücre aralığı.
 *
 * Kullanıcı ızgarasında koordinat SUNUCUYA HİÇ GİTMEZ (BR-26): cevap, hücrenin
 * iki ölçütüyle doğrulanır. Bu yüzden burada sabit boyut doğrudur — boyutu
 * parametreye çevirmek, var olmayan bir çağrı için genellik üretirdi.
 */
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
