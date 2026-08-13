import type { StatKey } from "@/domain/services/stat-match";
import type { Level } from "@/domain/services/which-more";
import type { PlayerId } from "@/domain/value-objects/identifiers";

/**
 * "Hangisi daha" veri erişimi — PORT (PROJECT.md §4.1, §9.3).
 */

/**
 * Turda sunulan bir oyuncu.
 *
 * `value` PORTUN İÇİNDE kalır: tur yanıtına GİRMEZ (BR-32). Burada taşınmasının
 * sebebi bir sonraki turun eşiğinin bu değer olmasıdır — uygulama katmanı onu
 * ikinci bir sorguyla tekrar okumak zorunda kalmasın diye.
 */
export interface WhichMoreCandidate {
  readonly id: PlayerId;
  readonly name: string;
  /** Oyuncuyu TANITMAK için, en çok üç kulüp. Karşılaştırılan değer değildir. */
  readonly clubs: readonly string[];
  readonly value: number;
}

/**
 * Aday sorgusu.
 *
 * `side` ve `threshold` birlikte BR-30'un dengeli çekimini ifade eder; hangi
 * tarafın seçileceğine domain karar verir (`opponentSide`), depo yalnızca
 * uygular. Kural burada olsaydı yazı tura veritabanı katmanında gömülü kalır
 * ve test edilemezdi.
 */
export interface WhichMoreCandidateQuery {
  readonly statKey: StatKey;

  /**
   * BR-41 — hangi havuzdan çekilecek.
   *
   * `"easy"` yalnızca "bilindik" oyuncuları içerir (`isWellKnown`), `"hard"`
   * havuzun tamamını. Seviye BURADA, cevap sorgusunda DEĞİL: hangi çiftin
   * KURULABİLECEĞİNİ daraltır, hangi cevabın DOĞRU olduğunu değiştirmez.
   */
  readonly level: Level;

  /**
   * Kalan oyuncunun değeri. `null` ise koşunun İLK oyuncusu çekiliyordur ve
   * sınır yoktur.
   */
  readonly threshold: number | null;

  /**
   * `above` / `below`: eşiğin o tarafından ve BR-29 bandı kadar uzaktan.
   * `any`: iki taraf da olur, band yine uygulanır (ilk çiftin ikinci oyuncusu).
   */
  readonly side: "above" | "below" | "any";

  /** Bu koşuda görülmüş oyuncular — BR-28, aynı isim ikinci kez sunulmaz. */
  readonly exclude: readonly PlayerId[];
}

export interface WhichMoreRepository {
  /**
   * Tanınırlık havuzundan (BR-31) RASTGELE bir aday.
   *
   * SÖZLEŞME:
   *  - Dönen oyuncunun `statKey` istatistiği DOLUDUR (`null` değeri olan
   *    oyuncu hiçbir zaman dönmez).
   *  - Oyuncu, BR-15'in tanınırlık eşiğini geçer: küratörlü kulüplerde 100+
   *    maç ve 2+ kulüp. §9.2'nin aksine ALTI istatistiğin dolu olması ARANMAZ
   *    (BR-31) — sorulmayan istatistiğin varlığı oyunu ilgilendirmiyor.
   *  - `threshold` doluysa dönen değer BR-29 bandını sağlar:
   *    `|value - threshold| >= MIN_GAP[statKey]`.
   *  - `side` "above" ise `value > threshold`, "below" ise `value < threshold`.
   *  - `level` "easy" ise dönen oyuncu `isWellKnown` ölçütünü de geçer.
   *  - `exclude` içindeki hiçbir kimlik dönmez.
   *
   * `null` = bu koşullarda aday YOK. Band gevşetilerek ya da eşik kaydırılarak
   * "bir şey" döndürülmez: sessiz gevşeme, sunucunun kurmayacağı bir çifti
   * kurması demek olurdu ve cevap ucu onu reddederdi (§9.1'in "süzgeç ile
   * doğrulayıcı aynı olmalı" kuralı).
   *
   * Ölçülen boş dönme sıklığı %0,00'dır (§9.3); yine de çağıran taraf `null`
   * ihtimalini ele almak zorundadır çünkü `exclude` uzadıkça havuz daralır.
   */
  findCandidate(
    query: WhichMoreCandidateQuery,
  ): Promise<WhichMoreCandidate | null>;

  /**
   * Kimliği bilinen bir oyuncunun aynı biçimdeki kaydı.
   *
   * İki yerde gerekli: kalan oyuncunun bir sonraki turda EŞİK olması (BR-30) ve
   * cevabın doğrulanması (BR-32). Tanınırlık süzgeci UYGULANMAZ — kimlik zaten
   * sunucunun kendi kurduğu bir turdan geliyor. AYNI GEREKÇEYLE SEVİYE DE
   * SORULMAZ (BR-41): kalan oyuncu bir önceki turda o seviyenin havuzundan
   * çekilmişti; ikinci kez süzmek yalnızca ikinci bir ayrışma kaynağı olurdu.
   *
   * `null` = oyuncu yok ya da bu istatistikte değeri yok. Sıfır DEĞİL: "golü
   * yok" ile "gol verisi yok" farklı şeylerdir (§2.7).
   *
   * DEĞER TANIMI, §9.2'nin `findStatValue`'suyla AYNI OLMAK ZORUNDA. İki mod
   * aynı sayıyı farklı hesaplarsa kullanıcı aynı oyuncuyu iki sayfada iki
   * değerle görür. Bu, bütünleşme testiyle karşılaştırılarak korunuyor —
   * "süzgeç ile doğrulayıcı aynı olmalı" kuralının (§9.1) buradaki karşılığı.
   */
  findPlayer(
    playerId: PlayerId,
    statKey: StatKey,
  ): Promise<WhichMoreCandidate | null>;
}
