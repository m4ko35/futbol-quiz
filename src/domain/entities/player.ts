import type { PlayerId } from "../value-objects/identifiers";

/**
 * Bir futbolcu (PROJECT.md §5.1).
 *
 * Cinsiyet alanı YOKTUR ve bilinçlidir: `P21` yalnızca veri kümesinin
 * kapsamını uygulamak için ETL'de okunur, veritabanına yazılmaz ve arayüzde
 * gösterilmez (BR-7).
 */
export interface Player {
  readonly id: PlayerId;
  readonly name: string;

  /** ISO 3166-1 alpha-2; bilinmiyorsa `null`. */
  readonly nationality: string | null;

  /** Normalize edilmiş mevki adı ("Kaleci", "Defans"…); bilinmiyorsa `null`. */
  readonly position: string | null;
}
