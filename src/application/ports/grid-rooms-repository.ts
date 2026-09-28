import type { CellRef } from "@/domain/services/grid";
import type {
  GridRoomConfig,
  GridRoomState,
} from "@/domain/services/grid-room";

/**
 * Izgara odası veri erişimi — PORT (PROJECT.md §4.1, §12.9).
 *
 * NEDEN `RoomsRepository`/`WhichMoreRoomsRepository`'DEN AYRI. İki paralel modun
 * deposu oyuncuların KENDİ ilerlemesini taşır (İstatistik `RoundState`, Hangisi
 * Daha düello cevapları). Izgara odasının durumu ORTAK bir hamle dizisidir —
 * kimin hangi hücreye ne oynadığı, GLOBAL sırayla. Üç şekli tek port'a
 * sığdırmak çalışan iki modu daraltma diliyle sarardı; ayrı port ikisine de
 * dokunmuyor (§12.8'in "İstatistik odası DEĞİŞMEZ" kararıyla aynı gerekçe).
 *
 * FİZİKSEL TABLOLAR PAYLAŞILIR ama bu bir DEPO değil ALTYAPI kararı: aynı
 * `rooms`/`room_players` tabloları `mode`/`config` ile ayrılır; hamleler ayrı
 * bir tabloda (`room_grid_moves`) durur (§12.9 veri modeli). Ortak yaşam
 * döngüsü metotları (katıl, sönmüş sil, sahip sil) Prisma katmanında ortak bir
 * yardımcıyı paylaşır.
 */

/** Bir Izgara odasının kaydı: saf alan durumu + depolamanın kimlikleri. */
export interface StoredGridRoom {
  readonly id: string;
  readonly code: string;
  /** BR-48 — hesap silinince oda da düşer. */
  readonly hostId: string;
  /** Oyun `state.config` içinde (tohum + ilk koltuk); hamleler `state.moves`. */
  readonly state: GridRoomState;
}

export type CreateGridRoomResult =
  | { readonly kind: "kuruldu"; readonly room: StoredGridRoom }
  /** BR-55 — kod çakıştı; çağıran yeni kodla dener (diğer odalarla aynı). */
  | { readonly kind: "kod-cakisti" };

export type JoinGridRoomResult =
  | { readonly kind: "katildi"; readonly room: StoredGridRoom }
  /** BR-54 — ikinci koltuğu başkası kaptı. */
  | { readonly kind: "dolu" };

export type SaveGridMoveResult =
  | { readonly kind: "yazildi"; readonly room: StoredGridRoom }
  /**
   * BR-72/BR-73 kısıt ihlali — hamle yazılamadı, GÜNCEL oda döner.
   *
   * İki kısıttan biri çiğnendi: `@@unique([roomId, moveIndex])` (aynı sıra
   * numarasına ikinci hamle — tek turda iki hamle yarışı) ya da
   * `@@unique([roomId, cellRow, cellCol])` (aynı hücreye ikinci hamle). İkisi de
   * eşzamanlı bir yazının yarışı; çağıran güncel duruma bakıp kendi hamlesi mi
   * yazıldı, yoksa gerçekten mi kaybettiğine karar verir.
   */
  | { readonly kind: "cakisti"; readonly room: StoredGridRoom };

export interface GridRoomsRepository {
  /**
   * Koda göre Izgara odası; yoksa (ya da oda başka moddaysa) `null`. Süresi
   * dolmuş oda da DÖNER — sönmüşlük kararı `gridRoomStatus`'ün (§12.3).
   */
  findByCode(code: string): Promise<StoredGridRoom | null>;

  /**
   * Odayı kurar ve kurucuyu 0'ıncı koltuğa oturtur — TEK İŞLEMDE.
   *
   * `config` tohumu + ilk koltuğu (BR-76) taşır. `startedAt` YAZILMAZ: sıra
   * ancak ikinci oyuncu katılınca başlar (BR-72).
   */
  createRoom(input: {
    readonly hostId: string;
    readonly code: string;
    readonly config: GridRoomConfig;
  }): Promise<CreateGridRoomResult>;

  /**
   * İkinci oyuncuyu 1'inci koltuğa oturtur ve sırayı başlatır — TEK İŞLEMDE.
   * (Diğer odalarla birebir aynı yaşam döngüsü; Prisma'da ortak.)
   */
  joinRoom(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly startedAt: Date;
  }): Promise<JoinGridRoomResult>;

  /**
   * Bir hamleyi yazar — BR-73.
   *
   * `correct` çağıran tarafından (ızgarayı tohumdan üretip `matchesAll` ile)
   * hesaplanmıştır; depo yalnızca saklar. `moveIndex` sıra numarasıdır ve
   * kısıtın parçası: tek turda iki hamle yarışını veritabanı durdurur.
   */
  saveMove(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly moveIndex: number;
    readonly cell: CellRef;
    readonly playerId: string;
    readonly correct: boolean;
  }): Promise<SaveGridMoveResult>;

  /** Kullanıcının KURDUĞU odaları siler — yeni oda kurmadan önce (BR-60). */
  deleteHostedRooms(hostId: string): Promise<void>;

  /** BR-60 — sönmüş odaları siler, silinen sayısını döner. */
  deleteExpiredRooms(cutoffs: {
    readonly unjoinedBefore: Date;
    readonly unfinishedBefore: Date;
  }): Promise<number>;
}
