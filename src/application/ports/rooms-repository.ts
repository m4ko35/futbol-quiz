import type { RoundAnswer } from "@/domain/services/daily-round";
import type { RoomState } from "@/domain/services/room";

/**
 * Oda veri erişimi — PORT (PROJECT.md §4.1, §12).
 *
 * NEDEN `AccountsRepository`'ye EKLENMEDİ. Odalar aynı veritabanında duruyor
 * ama ayrı bir kavram; hesap port'u zaten on bir imza taşıyor ve her yeni
 * özellik oraya eklendikçe "hesap deposu" adı anlamını yitirirdi. Depoların
 * sınırı tabloya değil KAVRAMA göre çiziliyor (§4.1) — `stat-match` ve
 * `which-more` de aynı futbol veritabanını paylaşıp ayrı port'lar taşıyor.
 *
 * Buradaki imzalar §12'nin KURALLARINI yansıtır, tabloların şeklini değil.
 * Bunun en görünür sonucu: hiçbir imza "durum" almıyor ya da döndürmüyor —
 * durum saklanmıyor, `roomStatus` ile türetiliyor (§12.3).
 */

/** Bir odanın kaydı: saf alan durumu artı depolamanın eklediği kimlikler. */
export interface StoredRoom {
  readonly id: string;
  readonly code: string;
  /** BR-48 — hesap silinince oda da düşer; sahiplik bu sütunda yazılı. */
  readonly hostId: string;
  /** BR-56 — sunucunun seçtiği hedef. Görünürlüğü BR-57'nin işi. */
  readonly targetPlayerId: string;
  readonly state: RoomState;
}

export type CreateRoomResult =
  | { readonly kind: "kuruldu"; readonly room: StoredRoom }
  /**
   * KOD ÇAKIŞTI — bir hata DEĞİL, beklenen ve nadir bir sonuç.
   *
   * Kod rastgele üretiliyor ve "önce bak, boşsa yaz" iki eşzamanlı kurulumda
   * aynı kodu iki odaya verebilirdi; o yarışı yalnızca veritabanı kısıtı
   * durdurur. Çağıran yeni bir kodla yeniden dener.
   */
  | { readonly kind: "kod-cakisti" };

export type JoinRoomResult =
  | { readonly kind: "katildi"; readonly room: StoredRoom }
  /**
   * BR-54 — ikinci koltuğu başkası kaptı.
   *
   * Kuralın kendisi `judgeJoin`'de ama ORASI YETMEZ: karar önce okuyup sonra
   * yazıyor, yani kodu iki arkadaşına birden söyleyen bir kurucunun ikisi de
   * aynı anda "odada bir kişi var" görebilir. Koltuk kısıtı
   * (`@@unique([roomId, seat])`) yarışın kaybedenini burada durduruyor.
   */
  | { readonly kind: "dolu" };

export type SaveRoomAnswerResult =
  | { readonly kind: "yazildi"; readonly room: StoredRoom }
  /**
   * BR-58 — bu istatistik (ya da bu oyuncu) zaten yazılmış.
   *
   * BR-43'ün oda karşılığı ve aynı anlamda: ikinci istek kendi hesapladığı
   * puanı değil SAKLANAN cevabı görür.
   */
  | { readonly kind: "zaten-var"; readonly room: StoredRoom };

export interface RoomsRepository {
  /**
   * Koda göre oda; yoksa `null`.
   *
   * SÜRESİ DOLMUŞ ODA DA DÖNER. Süzgeç burada olsaydı kullanıcı sönmüş bir
   * odaya girmeye çalıştığında "böyle bir oda yok" görürdü — oysa doğru cevap
   * "oda süresi doldu". İkisi farklı şeyler ve karışması, kodu yanlış yazan
   * kişiyi kodun doğru olduğuna inandırırdı. Sönmüşlük kararı `roomStatus`'ün.
   */
  findByCode(code: string): Promise<StoredRoom | null>;

  /**
   * Odayı kurar ve kurucuyu 0'ıncı koltuğa oturtur — TEK İŞLEMDE.
   *
   * Ayrı yazılsalardı araya giren bir hata oyuncusuz bir oda bırakırdı: kodu
   * paylaşılmış, katılınabilir ama içinde kimsenin olmadığı bir kayıt.
   *
   * `startedAt` YAZILMAZ (BR-57): hedef, ikinci oyuncu katılana kadar hiç
   * kimseye — kurucuya da — gösterilmez.
   */
  createRoom(input: {
    readonly hostId: string;
    readonly code: string;
    readonly targetPlayerId: string;
  }): Promise<CreateRoomResult>;

  /**
   * İkinci oyuncuyu 1'inci koltuğa oturtur ve turu başlatır — TEK İŞLEMDE.
   *
   * `startedAt` tam olarak burada yazılıyor ve BR-57'nin kapısı odur: o an
   * hedef iki tarafa da AYNI ANDA görünür hâle gelir. Ayrı bir "başlat"
   * çağrısı olsaydı arada kalan sürede oda iki kişilik ama hedefsiz olurdu.
   */
  joinRoom(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly startedAt: Date;
  }): Promise<JoinRoomResult>;

  /**
   * Cevabı yazar — BR-58.
   *
   * `points` GÜNCELLENMİYOR, `AccountsRepository.saveAnswer`'ın aksine: oda
   * sonucu hiçbir yerde sıralanmıyor (BR-60), yani türetilmiş bir toplam
   * sütununu tutarlı tutma külfetini ödemek için sebep yok. Toplam
   * cevaplardan hesaplanıyor.
   */
  saveAnswer(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly answer: RoundAnswer;
  }): Promise<SaveRoomAnswerResult>;

  /**
   * Kullanıcının KURDUĞU odaları siler — yeni oda kurmadan önce çağrılır.
   *
   * KATILDIĞI odalar silinmez: onlar başkasının odasıdır ve silmek,
   * arkadaşının oyununu elinden almak olurdu. Sahiplik `hostId`'de yazılı.
   */
  deleteHostedRooms(hostId: string): Promise<void>;

  /**
   * BR-60 — sönmüş odaları siler, silinen sayısını döner.
   *
   * EŞİKLER PARAMETRE, SORGUDA SABİT DEĞİL. Sönme kuralı alan katmanında
   * (`ROOM_JOIN_WINDOW_MS`, `ROOM_PLAY_WINDOW_MS`); süreleri SQL'e ikinci kez
   * yazmak, bir gün birinin yalnızca birini değiştirmesi demekti. Port yalnızca
   * "şu andan önce başlamamış" ve "şu andan önce bitmemiş" ayrımını biliyor.
   */
  deleteExpiredRooms(cutoffs: {
    readonly unjoinedBefore: Date;
    readonly unfinishedBefore: Date;
  }): Promise<number>;
}
