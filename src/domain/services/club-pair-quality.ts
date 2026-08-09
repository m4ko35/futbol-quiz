import type { Club } from "../entities/club";

/**
 * Dejenere kulüp çifti — BR-36, PROJECT.md §5.3.
 *
 * SORDUĞU SORU KİMLİK DEĞİL. "Bu iki kayıt aynı kulüp mü?" sorusunda ortak
 * oyuncu oranı ÖLÇÜLEREK çöktü: gerçek ikiz %92,5, yeniden kurulmuş kulüp
 * %94,0 — aynı bantta. Bu yüzden §5.3 birleştiren bir kural yazmayı reddetti
 * ve bu dosya da bir kimlik iddiasında BULUNMAZ.
 *
 * Sorduğu soru şu: bu iki kulübün ortak oyuncularını listelemek bir şey
 * öğretiyor mu? Condal ile Barcelona hukuken ayrı kulüptür — ve liste yine de
 * değersizdir, çünkü Condal'ın 65 oyuncusunun 52'si zaten Barcelona'da
 * oynamış. Kimliği bilmeye gerek yok; cevabın küçük kulübün kadrosunu
 * kapladığını ölçmek yetiyor. Aynı sinyal, farklı soru.
 *
 * RİSK PROFİLİ KARARIN TEMELİDİR. Yanlış birleştirme veriye yayılır ve geri
 * alınamaz; yanlış uyarı bir cümledir. Sinyal birleştirmede reddedilirken
 * burada kabul edilmesinin sebebi budur.
 */

/**
 * BR-36 eşiği: ortak oyuncu, küçük kulübün kadrosunun bu kadarını kaplıyorsa
 * çift dejeneredir.
 *
 * UYDURULMADI, ÖLÇÜLEN BOŞLUĞA KONDU. 906 seçilebilir kulübün en az bir
 * oyuncu paylaşan 118.247 çiftinde oran dağılımı taranınca %69,4 (Toulouse
 * 1937/1970) ile %76,8 (Karpaty ikizi) arasında HİÇBİR çift çıkmadı. Eşik o
 * boş bandın içindedir; 0,70–0,75 arası her değer aynı yedi çifti verir.
 *
 * Kaydırmanın bedeli ölçüldü: 0,80 → 4 çift (iki gerçek ikiz kaçar),
 * 0,60 → 10 çift (Toulouse ve Vicenza gibi ayrı kulüpler girer).
 */
export const DEGENERATE_PAIR_RATIO = 0.75;

/**
 * Ölçümün kendisi — yorumu değil.
 *
 * Oran ALANI YOK ve bu bilinçli: arayüz "65 oyuncusunun 52'si" diye
 * yazabilmeli, tek bir yüzde bu cümleyi kuramaz. Kullanıcı ham sayıları
 * görmeden iddiayı denetleyemez de.
 */
export interface DegeneratePair {
  /** İki kulüpte de dönemi olan oyuncu sayısı. */
  readonly sharedPlayers: number;
  /** Küçük kulübün altyapı dışı tekil oyuncu sayısı. */
  readonly smallerClubPlayers: number;
  /** Uyarı cümlesinde geçecek kulüp adı. */
  readonly smallerClubName: string;
}

/**
 * Çift dejenere mi? Değilse `null`.
 *
 * `null` dönmesi "sağlıklı" demek değil, "bu kural bir şey söylemiyor"
 * demektir — §2.7'nin yönü: bilinmeyen, olumsuz cevaba çevrilmez.
 *
 * KADROSU BİLİNMEYEN KULÜP UYARI ÜRETMEZ. `playerCount` sıfırsa payda yok;
 * sıfıra bölmek yerine kural susar. Bu, `db:verify`'ın ayrıca ölçtüğü bir
 * veri kusurudur (§8.2) ve sunum katmanında telafi edilmez.
 */
export function findDegeneratePair(input: {
  readonly clubA: Club;
  readonly clubB: Club;
  readonly sharedPlayers: number;
}): DegeneratePair | null {
  const { clubA, clubB, sharedPlayers } = input;

  const smaller = clubA.playerCount <= clubB.playerCount ? clubA : clubB;
  const smallerClubPlayers = smaller.playerCount;

  if (smallerClubPlayers === 0) return null;
  if (sharedPlayers / smallerClubPlayers < DEGENERATE_PAIR_RATIO) return null;

  return {
    sharedPlayers,
    smallerClubPlayers,
    smallerClubName: smaller.shortName,
  };
}
