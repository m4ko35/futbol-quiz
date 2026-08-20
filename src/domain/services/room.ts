import { isRoundFinished, roundPoints, type RoundState } from "./daily-round";

/**
 * Odanın kuralları — PROJECT.md §12, BR-54/BR-56/BR-57/BR-60/BR-61/BR-62.
 *
 * Bu dosya saf kuraldır: depolama, kimlik, rastgelelik ve saat burada YOKTUR
 * (§2.1). Zaman bir PARAMETREDİR (`now`), okunmuş bir değer değil — aksi
 * hâlde sönme kuralları yalnızca gerçek zaman beklenerek sınanabilirdi.
 *
 * TURUN KENDİSİ BURADA DEĞİL. Oda oyunu yeniden tanımlamıyor; §11'in günlük
 * turuyla birebir aynı oyunu oynatıyor. Cevap kuralları (BR-43'ün oda
 * karşılığı BR-58, BR-17, hedefin cevap olamaması) `daily-round.ts` içinde
 * duruyor ve buradan YENİDEN KULLANILIYOR. Kopyalansaydı iki kural kümesi
 * zamanla ayrışırdı ve ayrışma sessiz olurdu.
 */

/** BR-54 — oda iki kişiliktir. */
export const MAX_ROOM_PLAYERS = 2;

/** BR-60 — ikinci oyuncu bu süre içinde katılmazsa oda söner. */
export const ROOM_JOIN_WINDOW_MS = 30 * 60 * 1000;

/** BR-60 — tur bu süre içinde bitmezse oda söner. */
export const ROOM_PLAY_WINDOW_MS = 60 * 60 * 1000;

/**
 * Bir oyuncunun odadaki hâli.
 *
 * `completedAt` YOK ve bu bilinçli. Bitmişlik turun kendisinden okunuyor
 * (`isRoundFinished`); ayrıca saklansaydı türetilmiş bir alan olurdu ve
 * türetilmiş alanlar ayrışır — `DailyRound.points` bunu göze alarak saklıyor
 * çünkü lider tablosu sorgusu ona bağlı, burada öyle bir gerekçe yok.
 *
 * BR-62 zaten süreye bakmıyor: eşit toplam beraberliktir, ilk bitiren
 * kazanmaz. Yani bitiş ANI hiçbir kuralın girdisi değil.
 */
export interface RoomPlayerState {
  readonly userId: string;
  /** Sonuç ekranı ad gösterir (BR-54); kimlik numarası okunmaz. */
  readonly displayName: string;
  readonly round: RoundState;
}

export interface RoomState {
  readonly createdAt: Date;
  /**
   * İkinci oyuncunun katıldığı an — BR-57'nin kapısı.
   *
   * `null` olduğu sürece hedef HİÇ KİMSEYE gönderilmez, kurucuya da. Erken
   * verilseydi kurucu, arkadaşı kodu girene kadar hazırlanabilirdi; BR-56
   * "kurucu hedefi seçmesin" derken tam olarak bu avantajı kapatıyor ve
   * hedefi erken göstermek onu arka kapıdan geri açardı.
   */
  readonly startedAt: Date | null;
  readonly players: readonly RoomPlayerState[];
}

/**
 * Odanın durumu — SAKLANMAZ, TÜRETİLİR.
 *
 * Bir `status` sütunu tutmak cazipti ve reddedildi: sütun ile gerçekler
 * (oyuncu sayısı, cevaplar, saat) ayrışabilir ve ayrıştığında hangisinin
 * doğru olduğunu kimse bilemez. Durum tek bir yerde, olgulardan hesaplanıyor;
 * ayrışacak ikinci bir kaynak hiç yok.
 */
export type RoomStatus = "bekliyor" | "oynaniyor" | "bitti" | "suresi-doldu";

/**
 * Odanın ölüm anı — BR-60.
 *
 * İki pencere var çünkü iki farklı bekleyiş var: katılmayan arkadaş (30 dk)
 * ile bitirmeyen rakip (60 dk). Tek bir süre ikisinden birine yanlış gelirdi.
 */
export function roomDeadline(room: RoomState): Date {
  return room.startedAt === null
    ? new Date(room.createdAt.getTime() + ROOM_JOIN_WINDOW_MS)
    : new Date(room.startedAt.getTime() + ROOM_PLAY_WINDOW_MS);
}

/** İki oyuncu da altı istatistiği bitirdi mi? */
export function isRoomFinished(room: RoomState): boolean {
  return (
    room.players.length === MAX_ROOM_PLAYERS &&
    room.players.every((player) => isRoundFinished(player.round))
  );
}

/**
 * BİTMİŞ ODA SÖNMEZ ve sıra bu yüzden önemli.
 *
 * Süre denetimi önce yapılsaydı, altmışıncı dakikada bitirilmiş bir tur
 * altmış birinci dakikada "süresi doldu" olurdu — yani oyun oynanıp bittikten
 * sonra sonucu kaybolurdu. Bitmişlik, saatten önce gelir.
 */
export function roomStatus(room: RoomState, now: Date): RoomStatus {
  if (isRoomFinished(room)) return "bitti";
  if (now.getTime() >= roomDeadline(room).getTime()) return "suresi-doldu";
  return room.startedAt === null ? "bekliyor" : "oynaniyor";
}

/**
 * BR-57 — hedef görünür mü?
 *
 * Ölçüt `startedAt`tir, durumun kendisi değil: oda sönmüş olsa bile hedef bir
 * kez açılmışsa artık sırdır sayılamaz. Sönmüş odada hedefi gizlemek bilgi
 * korumaz, yalnızca ekranı tutarsız gösterir.
 */
export function isTargetVisible(room: RoomState): boolean {
  return room.startedAt !== null;
}

export function isMember(room: RoomState, userId: string): boolean {
  return room.players.some((player) => player.userId === userId);
}

export type RoomJoinRejection = "oda-dolu" | "oda-kapali";

export type RoomJoinVerdict =
  /**
   * Zaten üyesin — BU BİR RET DEĞİL.
   *
   * `judgeSubmission`'ın "tekrar" dalıyla aynı gerekçe: sayfayı yenileyen ya
   * da yanıtı alamayıp isteği tekrarlayan kullanıcı hata görmemeli. Odaya
   * ikinci kez "katılmak" bir kural ihlali değil, aynı isteğin tekrarıdır.
   */
  | { readonly kind: "zaten-uye" }
  | { readonly kind: "ret"; readonly reason: RoomJoinRejection }
  | { readonly kind: "katil" };

/**
 * BR-54 — katılma kararı.
 *
 * SIRA KURALIN PARÇASI: önce üyelik, sonra kapılık, sonra doluluk. Üyelik
 * sona bırakılsaydı, iki kişilik dolu bir odanın KENDİ üyesi sayfayı
 * yenilediğinde "oda dolu" hatası alırdı — oysa odayı dolduran kişi kendisi.
 */
export function judgeJoin(
  room: RoomState,
  userId: string,
  now: Date,
): RoomJoinVerdict {
  if (isMember(room, userId)) return { kind: "zaten-uye" };

  const status = roomStatus(room, now);
  if (status !== "bekliyor") return { kind: "ret", reason: "oda-kapali" };

  // `bekliyor` zaten tek oyuncu demek; bu satır bir güvenlik ağıdır ve
  // durum kuralı değişirse sessizce üçüncü kişi almamızı engeller.
  if (room.players.length >= MAX_ROOM_PLAYERS) {
    return { kind: "ret", reason: "oda-dolu" };
  }

  return { kind: "katil" };
}

export type RoomOutcome =
  /** Henüz bitmedi ve sönmedi. */
  | { readonly kind: "devam" }
  /** BR-61 — biri bırakıp gitti; hükmen galip YOK. */
  | { readonly kind: "yarim" }
  /** BR-62 — eşit toplam beraberliktir; süreye bakılmaz. */
  | { readonly kind: "beraberlik"; readonly points: number }
  | {
      readonly kind: "galip";
      readonly winnerId: string;
      readonly winnerPoints: number;
      readonly loserPoints: number;
    };

/**
 * Odanın sonucu — BR-61, BR-62.
 *
 * YARIM KALAN TURUN GALİBİ YOKTUR. Bitiren tarafı hükmen galip saymak cazipti
 * ve reddedildi: BR-45'in gerekçesiyle aynı — kişi kötü oynadığı için değil,
 * BİTİRMEDİĞİ için sonuç yok. Üstelik hükmen galibiyet, rakibi bağlantısını
 * kesmeye zorlayan bir oyun teşviki yaratırdı.
 */
export function roomOutcome(room: RoomState, now: Date): RoomOutcome {
  const status = roomStatus(room, now);
  if (status === "suresi-doldu") return { kind: "yarim" };
  if (status !== "bitti") return { kind: "devam" };

  const [first, second] = room.players;
  // `bitti` iki oyuncuyu garanti eder; bu dal yalnızca tipi daraltıyor.
  if (first === undefined || second === undefined) return { kind: "devam" };

  const firstPoints = roundPoints(first.round);
  const secondPoints = roundPoints(second.round);

  if (firstPoints === secondPoints) {
    return { kind: "beraberlik", points: firstPoints };
  }

  const won = firstPoints > secondPoints ? first : second;
  return {
    kind: "galip",
    winnerId: won.userId,
    winnerPoints: Math.max(firstPoints, secondPoints),
    loserPoints: Math.min(firstPoints, secondPoints),
  };
}
