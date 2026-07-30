import type { ClubId } from "../value-objects/identifiers";

/** Bir futbol kulübü (PROJECT.md §5.1). */
export interface Club {
  readonly id: ClubId;
  readonly name: string;
  readonly shortName: string;

  /** ISO 3166-1 alpha-2; Wikidata'da yoksa `null`. */
  readonly country: string | null;
  readonly foundedYear: number | null;
  readonly crestUrl: string | null;

  /**
   * Kullanıcıya sunulan seçim listesinde görünür mü?
   *
   * Veritabanı, oyuncuların geçtiği her kulübü tutar; ama feshedilmiş selef
   * kulüpler ve neredeyse hiç kaydı olmayan varlıklar seçilirse kullanıcı boş
   * sonuç alır. Eşik ve gerekçesi: §5.3.
   */
  readonly isSelectable: boolean;
}
