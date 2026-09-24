import type { GridRoomDto } from "@/application/use-cases/grid-rooms";
import type { PollPhase } from "./room-polling";

/**
 * Izgara (XOX) odasının yoklama siyaseti — §12.1, §12.9.
 *
 * Diğer oda modlarının (`room-polling.ts`) karşılığı; taban aralıklar ve büyüme
 * (`pollDelay`, `POLL_MAX_MS`) ORADAN paylaşılıyor. Değişen tek şey "hangi
 * düzendeyim" ve "yeni yanıt mı" kararı: burası SIRA tabanlı, o yüzden düzen
 * "sıra kimde"ye bakar.
 */

/**
 * Hangi düzen geçerli; `null` ise oda bitmiştir ve yoklama DURUR.
 *
 * Sıra bende → `oynuyorum` (seyrek: zaten meşgulüm, hamlem odayı güncelliyor).
 * Sıra rakipte → `rakibi-bekliyorum` (sık: rakibin hamlesi ekranın tek olayı,
 * lobi kadar hızlı yoklanmalı).
 */
export function gridPollPhase(room: GridRoomDto): PollPhase | null {
  if (room.status === "bitti" || room.status === "suresi-doldu") return null;
  if (room.status === "bekliyor") return "lobi";
  return room.yourTurn ? "oynuyorum" : "rakibi-bekliyorum";
}

/**
 * Yanıtın "yeni" olup olmadığı — tahta HERKESE AÇIK olduğu için (BR-70 yok)
 * doğrudan tahtaya bakılır. Rakibin hamlesi hem tahtayı değiştirir hem sırayı
 * döndürür; ikisi de imzada. `expiresAt` gibi her yanıtta oynayan alanlar dışarıda.
 */
export function gridPollSignature(room: GridRoomDto): string {
  const board = room.board
    .flat()
    .map((cell) =>
      cell.kind === "bos" ? "." : cell.kind === "olu" ? "-" : cell.mark,
    )
    .join("");
  return [room.status, room.yourTurn ? "1" : "0", room.outcome, board].join(
    "|",
  );
}
