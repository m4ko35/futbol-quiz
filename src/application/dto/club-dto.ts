import type { Club } from "@/domain/entities/club";

/**
 * Dışarı dönen kulüp şekli — PROJECT.md §6.1.
 *
 * NEDEN ayrı bir tip: §2.4, "veritabanı satırı ≠ API yanıtı". Varlığa yarın
 * bir alan eklendiğinde (ör. iç kullanım için bir puan) o alan kendiliğinden
 * yanıta sızmamalı. Dönüşüm elle yazıldığı için her yeni alan bilinçli bir
 * karar gerektirir.
 */
export interface ClubDto {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly country: string | null;
  readonly crestUrl: string | null;
}

export function toClubDto(club: Club): ClubDto {
  return {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    country: club.country,
    crestUrl: club.crestUrl,
  };
}
