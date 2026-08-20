import type { NextRequest } from "next/server";
import type { RoomDeps } from "@/application/use-cases/rooms";
import { ValidationError } from "@/domain/errors/domain-error";
import { roomCode } from "@/domain/value-objects/room-code";
import {
  repositories,
  roomsRepository,
} from "@/infrastructure/db/repositories";
import { WebCryptoRandomSource } from "@/infrastructure/random/web-crypto-random";
import { currentUserFromRequest } from "@/lib/auth/current-user";

/**
 * Oda uçlarının ortak girişi — PROJECT.md §12.4.
 *
 * NEDEN ORTAK. Dört uç da aynı üç şeyi yapıyor: hesap özelliğinin açık
 * olduğunu doğrula, oturumu oku, bağımlılıkları kur. Dört kopya yazılsaydı
 * biri güncellenip diğerleri unutulurdu — §11.11'de gezinme bağlantısının
 * koşulsuz kalması tam olarak böyle olmuştu.
 *
 * KİMLİK SUNUCUDAN OKUNUR, GÖVDEDEN DEĞİL. Gövdeden gelseydi istemci
 * başkasının kimliğiyle odaya girer, onun turuna cevap yazardı.
 */

const LOGIN_REQUIRED = "Oda için giriş yapmalısın.";

export interface RoomRequestContext {
  readonly userId: string;
  readonly deps: RoomDeps;
}

/**
 * Rastgelelik kaynağı TEK ÖRNEK.
 *
 * Durumsuz olduğu için paylaşmanın bir sakıncası yok; her istekte yeniden
 * kurmak da yalnızca çöp üretirdi.
 */
const random = new WebCryptoRandomSource();

export async function roomRequestContext(
  request: NextRequest,
): Promise<RoomRequestContext> {
  const rooms = roomsRepository();

  /**
   * Hesap özelliği kapalıysa oda da yok (BR-54: iki taraf da giriş yapmış
   * olmalı). Girişsiz istek `400` alır, `401` değil — §11.12'nin bildirim
   * ucuyla aynı gerekçe: §6'nın hata sözleşmesini arayüzün hiç kullanmadığı
   * bir yol için genişletmek, kazandırdığından fazlasını götürürdü.
   */
  if (rooms === null) throw new ValidationError(LOGIN_REQUIRED);

  const user = await currentUserFromRequest(request);
  if (user === null) throw new ValidationError(LOGIN_REQUIRED);

  return {
    userId: user.id,
    deps: { rooms, statMatch: repositories.statMatch, random },
  };
}

/**
 * Adresteki kodu doğrular — BR-55.
 *
 * AYIKLAMA BURADA DEĞİL `roomCode` İÇİNDE: kullanıcı `bkj-7tz` yazabilir ve
 * onu koda indirgemek alan katmanının işi. Uç yalnızca reddi çeviriyor.
 */
export function parseRoomCode(raw: string): string {
  try {
    return roomCode(decodeURIComponent(raw));
  } catch {
    // Ham değer yanıta GİRMEZ (§6.3): ayıklanmış hâli bile kullanıcının
    // yazdığı şeyi geri yansıtmak olurdu.
    throw new ValidationError("Oda kodu geçersiz.");
  }
}
