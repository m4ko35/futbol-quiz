import type { WhichMoreRoomDto } from "@/application/use-cases/which-more-rooms";
import type { PollPhase } from "./room-polling";

/**
 * Hangisi Daha odasının yoklama siyaseti — §12.1, §12.8.
 *
 * İstatistik odasının (`room-polling.ts`) karşılığı; taban aralıklar ve büyüme
 * (`pollDelay`, `POLL_MAX_MS`) ORADAN paylaşılıyor — kopyalanmıyor. Değişen tek
 * şey "hangi düzendeyim" ve "yeni yanıt mı" kararı: İstatistik altı istatistiğe
 * bakıyordu, burada düello akışına bakılıyor.
 */

/**
 * Hangi düzen geçerli; `null` ise oda bitmiştir ve yoklama DURUR.
 *
 * `rakibi-bekliyorum`: kendi koşum bitti (Ani ölümde elendim, Sabit N'de N'i
 * tükettim, ya da ray tükendi) ve ekranda yapacak bir şey kalmadı — beklenen
 * tek şey sonucun kesinleşmesi. `currentDuel === null` bunu tam söyler.
 */
export function whichMorePollPhase(room: WhichMoreRoomDto): PollPhase | null {
  if (room.status === "bitti" || room.status === "suresi-doldu") return null;
  if (room.status === "bekliyor") return "lobi";

  return room.currentDuel === null ? "rakibi-bekliyorum" : "oynuyorum";
}

/**
 * Yanıtın "yeni" olup olmadığı — yalnızca gözlemlenebilir olgular.
 *
 * BR-70 gereği rakibin serisi/doğru sayısı gizli; gözlemlenebilir olan durumu:
 * Ani ölümde `eliminated`, Sabit N'de `answered` (ilerleme). İkisini de
 * imzaya katıyoruz ki rakip ilerleyince yoklama hızlansın. `expiresAt` ve
 * `currentRoundIndex` gibi her yanıtta oynayabilen alanlar DIŞARIDA.
 */
export function whichMorePollSignature(room: WhichMoreRoomDto): string {
  return [
    room.status,
    room.me.answered,
    room.opponent?.answered ?? -1,
    String(room.opponent?.eliminated ?? false),
  ].join("|");
}
