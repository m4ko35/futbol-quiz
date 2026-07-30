import type { Player } from "@/domain/entities/player";

/**
 * Dışarı dönen oyuncu şekli — ızgara cevap seçici için (PROJECT.md §6.4).
 *
 * KASITLI OLARAK DAR. Oyuncunun kulüp geçmişi bu yanıtta YOKTUR: seçici,
 * cevabın doğru olup olmadığını gösteren bir arayüz değil, yalnızca bir arama
 * kutusudur. Dönemleri döndürmek, kullanıcının "hangi kulüplerde oynadı"
 * listesine bakıp doğru hücreyi bulmasını sağlardı — yani oyunu çözerdi (§2.4).
 *
 * `nationality` ve `position` ise KALIR: aynı adı taşıyan iki oyuncuyu ayırt
 * etmek için gerekli. "Ronaldo" araması iki ayrı kaydı döndürür ve kullanıcının
 * hangisini seçtiğini bilmesi gerekir. Bunlar ızgara kriteri de olabildiği için
 * ("Brezilya" satırı) küçük bir ipucu taşırlar; kabul edilen bir maliyet, çünkü
 * alternatif ayırt edilemeyen bir listedir.
 */
export interface PlayerDto {
  readonly id: string;
  readonly name: string;
  readonly nationality: string | null;
  readonly position: string | null;
}

export function toPlayerDto(player: Player): PlayerDto {
  return {
    id: player.id,
    name: player.name,
    nationality: player.nationality,
    position: player.position,
  };
}
