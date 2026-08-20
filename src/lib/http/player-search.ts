import type { PlayerDto } from "@/application/dto/player-dto";
import type { StatKey } from "@/domain/services/stat-match";
import { readErrorMessage } from "./error-message";

/**
 * İstatistik modunun oyuncu aramaları — PROJECT.md §9.2, §12.
 *
 * NEDEN MODÜL DÜZEYİNDE, BİLEŞENİN İÇİNDE DEĞİL. İki ekran (günlük tur ve
 * oda) aynı iki aramayı yapıyor ve `PlayerPicker` her render'da yeni bir
 * fonksiyon referansı görürse arama efektini baştan çalıştırıyor. Bileşen
 * içinde tanımlandığında bu `useCallback` ile çözülüyordu; modül düzeyinde
 * referans zaten sabit ve sarmalayıcıya hiç gerek kalmıyor.
 *
 * SÜZGEÇLER SÜS DEĞİL, İKİSİ DE ÖLÇÜLMÜŞ BİR KUSURUN ONARIMI (§9.2).
 */

async function search(params: URLSearchParams, signal: AbortSignal) {
  const response = await fetch(`/api/players?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(await readErrorMessage(response));

  const body = (await response.json()) as { data: PlayerDto[] };
  return body.data;
}

/**
 * BR-16 — arama, AÇIK OLAN istatistikte puanlanabilir oyuncularla sınırlanır.
 *
 * Süzgeç olmadan seçici, verisi olmayan oyuncuları da listeliyordu: "Buffon"
 * araması alfabetik sırayla önce "Armando Buffon"u getiriyor, kullanıcı onu
 * seçiyor ve sunucu haklı olarak reddediyordu. Oyun bir duvara dönüşüyordu.
 */
export function searchPlayersForStat(
  term: string,
  signal: AbortSignal,
  statKey: StatKey,
): Promise<PlayerDto[]> {
  return search(new URLSearchParams({ q: term, stat: statKey }), signal);
}

/**
 * BR-24 — hedef arayışı. `target=true` olmadan ilk 20 sonucun yalnızca
 * %18–50'si seçilebilir çıkıyordu (§9.2'de ölçüldü); süzgeç, sunucunun
 * reddedeceği isimleri listeden baştan çıkarır.
 *
 * ODADA KULLANILMAZ: hedefi sunucu seçer (BR-56).
 */
export function searchTargets(
  term: string,
  signal: AbortSignal,
): Promise<PlayerDto[]> {
  return search(new URLSearchParams({ q: term, target: "true" }), signal);
}
