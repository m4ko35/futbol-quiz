import type {
  WhichMoreDuelAnswer,
  WhichMoreRoomConfig,
  WhichMoreRoomState,
} from "@/domain/services/which-more-room";

/**
 * Hangisi Daha odası veri erişimi — PORT (PROJECT.md §4.1, §12.8).
 *
 * NEDEN `RoomsRepository`'DEN AYRI. İstatistik odasının deposu (`StoredRoom`)
 * baştan sona İstatistik'in şeklinde: `targetPlayerId` dolu, oyuncular altı
 * istatistiklik `RoundState` taşır. Hangisi Daha odasının durumu bambaşka —
 * hedef yok (ray var), oyuncular DÜELLO cevapları taşır, oda `config`
 * içinde submode/tohum tutar. İki şekli tek port'a sığdırmak (`StoredRoom`'u
 * etiketli birliğe çevirmek) ÇALIŞAN İstatistik odası kodunu baştan aşağı
 * daraltma diliyle sararak değiştirmeyi gerektirirdi; §12.8'in "İstatistik
 * odası DEĞİŞMEZ" kuralı buna karşı. Ayrı port, İstatistik'e hiç dokunmuyor.
 *
 * FİZİKSEL TABLOLAR PAYLAŞILIR ama bu bir DEPO değil ALTYAPI kararı: aynı
 * `rooms`/`room_players` tabloları, moda göre `mode`/`config` sütunlarıyla
 * ayrılır ve cevaplar ayrı bir tabloda (`room_which_more_answers`) durur (§12.8
 * veri modeli). İki deponun ortak yaşam döngüsü metotları (katıl, sönmüş sil,
 * sahip sil) Prisma katmanında ortak bir yardımcıyı paylaşır — port ikisini de
 * bildirir çünkü use-case ikisine de ihtiyaç duyar.
 */

/** Bir Hangisi Daha odasının kaydı: saf alan durumu + depolamanın kimlikleri. */
export interface StoredWhichMoreRoom {
  readonly id: string;
  readonly code: string;
  /** BR-48 — hesap silinince oda da düşer. */
  readonly hostId: string;
  /** Oyun yapılandırması `state.config` içinde; ayrı bir hedef YOK (ray var). */
  readonly state: WhichMoreRoomState;
}

export type CreateWhichMoreRoomResult =
  | { readonly kind: "kuruldu"; readonly room: StoredWhichMoreRoom }
  /** BR-55 — kod çakıştı; çağıran yeni kodla dener (İstatistik ile aynı). */
  | { readonly kind: "kod-cakisti" };

export type JoinWhichMoreRoomResult =
  | { readonly kind: "katildi"; readonly room: StoredWhichMoreRoom }
  /** BR-54 — ikinci koltuğu başkası kaptı (koltuk kısıtı yarışı burada durur). */
  | { readonly kind: "dolu" };

export type SaveWhichMoreAnswerResult =
  | { readonly kind: "yazildi"; readonly room: StoredWhichMoreRoom }
  /**
   * BR-58 hattı — bu tur indeksine zaten cevap yazılmış.
   *
   * `@@unique([roomPlayerId, roundIndex])` ihlali; ikinci istek kendi
   * hesabını değil SAKLANAN cevabı görür.
   */
  | { readonly kind: "zaten-var"; readonly room: StoredWhichMoreRoom };

export interface WhichMoreRoomsRepository {
  /**
   * Koda göre Hangisi Daha odası; yoksa (ya da oda İstatistik modundaysa)
   * `null`. Süresi dolmuş oda da DÖNER — sönmüşlük kararı `whichMoreRoomStatus`'ün
   * (§12.3, İstatistik ile aynı gerekçe).
   */
  findByCode(code: string): Promise<StoredWhichMoreRoom | null>;

  /**
   * Odayı kurar ve kurucuyu 0'ıncı koltuğa oturtur — TEK İŞLEMDE.
   *
   * `config` TOHUMUYLA gelir (use-case üretti); `startedAt` YAZILMAZ (BR-57):
   * ray ikinci oyuncu katılana kadar iki tarafa da açılmaz.
   */
  createRoom(input: {
    readonly hostId: string;
    readonly code: string;
    readonly config: WhichMoreRoomConfig;
  }): Promise<CreateWhichMoreRoomResult>;

  /**
   * İkinci oyuncuyu 1'inci koltuğa oturtur ve turu başlatır — TEK İŞLEMDE.
   * (İstatistik `joinRoom` ile birebir aynı yaşam döngüsü; Prisma'da ortak.)
   */
  joinRoom(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly startedAt: Date;
  }): Promise<JoinWhichMoreRoomResult>;

  /**
   * Bir düello cevabını yazar — BR-58 hattı.
   *
   * `correct` çağıran tarafından (sunucu rayı oynatarak) hesaplanmıştır; depo
   * yalnızca saklar. Puan/toplam GÜNCELLENMEZ: oda sonucu hiçbir yerde
   * sıralanmaz (BR-60), seri cevaplardan türetilir (§12.3).
   */
  saveAnswer(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly answer: WhichMoreDuelAnswer;
  }): Promise<SaveWhichMoreAnswerResult>;

  /** Kullanıcının KURDUĞU odaları siler — yeni oda kurmadan önce (BR-60). */
  deleteHostedRooms(hostId: string): Promise<void>;

  /** BR-60 — sönmüş odaları siler, silinen sayısını döner. */
  deleteExpiredRooms(cutoffs: {
    readonly unjoinedBefore: Date;
    readonly unfinishedBefore: Date;
  }): Promise<number>;
}
