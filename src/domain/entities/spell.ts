import type { ClubId, PlayerId } from "../value-objects/identifiers";
import type { YearRange } from "../value-objects/year-range";

/**
 * Bir oyuncunun bir kulüpteki TEK bir dönemi (PROJECT.md §5.1).
 *
 * Ayrı bir varlık olmasının sebebi tekrarlardır: aynı oyuncu aynı kulüpte
 * birden çok kez oynayabilir (kiralık dönüşü, yıllar sonra geri dönüş). Düz
 * bir çoktan-çoğa ilişki bu tekrarları temsil edemez, "kaç kez ve ne zaman"
 * sorusunu cevaplayamazdı.
 */
export interface Spell {
  readonly playerId: PlayerId;
  readonly clubId: ClubId;

  readonly years: YearRange;

  /** Oyuncu hâlâ kulüpte mi? `years.end === null` tek başına ayırt etmez. */
  readonly isCurrent: boolean;

  /** BR-3: kiralık dönemler sayılır, ama arayüzde işaretlenir. */
  readonly isLoan: boolean;

  /** BR-2: altyapı dönemleri varsayılan olarak sayılmaz. */
  readonly isYouth: boolean;

  /** Wikidata'da yoksa `null` — sıfır DEĞİL (§2.7). */
  readonly appearances: number | null;
  readonly goals: number | null;
}
