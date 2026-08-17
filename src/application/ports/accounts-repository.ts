import type { RoundAnswer, RoundState } from "@/domain/services/daily-round";
import type { CompletedRound } from "@/domain/services/leaderboard";
import type { ReportReason } from "@/domain/value-objects/report-reason";

/**
 * Hesap ve lider tablosu veri erişimi — PORT (PROJECT.md §4.1, §11).
 *
 * Port, çağıranı Turso'dan da Prisma'dan da habersiz bırakır. Buradaki
 * imzalar §11'in KURALLARINI yansıtır, veritabanının şeklini değil.
 */

/** Kayıtlı kullanıcı. E-posta YOKTUR ve olmayacak (§11.3). */
export interface Account {
  readonly id: string;
  readonly displayName: string;
}

/**
 * Bir turun kaydı: durum artı kimlik.
 *
 * `state` saf alan adır (`daily-round.ts`); `id` ve `completedAt` depolamanın
 * eklediği bilgidir.
 */
export interface StoredRound {
  readonly id: string;
  readonly puzzleDay: number;
  readonly state: RoundState;
  readonly completedAt: Date | null;
}

/** Cevap yazma girişiminin sonucu — BR-43. */
export type SaveAnswerResult =
  /** Yazıldı. */
  | { readonly kind: "yazildi"; readonly round: StoredRound }
  /**
   * YARIŞ KAYBEDİLDİ: aynı istatistiğe (ya da aynı oyuncuya) eşzamanlı ikinci
   * bir istek önce yazmış. Veritabanı kısıtı durdurdu; saklanan tur dönüyor.
   *
   * Bu bir hata DEĞİL: BR-43 zaten "ikinci istek ilk cevabı döner" diyor ve
   * yarışın kaybedeni de ikinci istektir.
   */
  | { readonly kind: "zaten-var"; readonly round: StoredRound };

/** Bildirim yazma girişiminin sonucu — BR-53. */
export type SaveReportResult =
  | "yazildi"
  /**
   * Aynı kullanıcı bu hedefi ZATEN bildirmiş. Veritabanı kısıtı durdurdu
   * (`@@unique([reporterId, reportedId])`); "önce bak sonra yaz" eşzamanlı
   * iki istekte iki satır üretirdi.
   */
  | "zaten-bildirdi";

export interface AccountsRepository {
  /**
   * Google `sub` ÖZETİNDEN kullanıcıyı bulur — ham `sub` bu katmana hiç
   * girmez (§11.10). Özetleme çağıranın işidir; port ham değeri kabul
   * etseydi, bir gün birinin onu olduğu gibi yazması an meselesi olurdu.
   */
  findBySubjectHash(subjectHash: string): Promise<Account | null>;

  findById(id: string): Promise<Account | null>;

  /**
   * Görünen adın TEKİLLİK ANAHTARINDAN kullanıcıyı bulur — BR-46, BR-53.
   *
   * Anahtar çağıran tarafından üretilir (`displayNameKey()`), çünkü
   * normalleştirme bir DOMAIN kararıdır; port ham ad kabul etseydi "Mehmet"
   * ile "mehmet" farklı kullanıcılara denk gelirdi.
   */
  findByDisplayNameKey(key: string): Promise<Account | null>;

  /**
   * Yeni hesap açar — BR-46.
   *
   * `null` = görünen ad ZATEN ALINMIŞ. Sessizce ad değiştirilmez; kullanıcı
   * kendi seçtiği adla açıldığını sanmamalı.
   *
   * `displayNameKey` çağıran tarafından üretilir (`displayNameKey()`),
   * çünkü tekillik ölçütü bir DOMAIN kararıdır — veritabanı onu yalnızca
   * zorlar, tanımlamaz.
   */
  createAccount(input: {
    readonly subjectHash: string;
    readonly displayName: string;
    readonly displayNameKey: string;
  }): Promise<Account | null>;

  /** BR-48 — hesap ve bütün skorları silinir. */
  deleteAccount(id: string): Promise<void>;

  /**
   * Kullanıcının o güne ait turu; yoksa `null`.
   *
   * AÇMAZ: sadece okur. Turu yazma anında açmak (`saveAnswer`), boş turların
   * birikmesini önler — sayfayı açıp oynamayan herkes için satır üretmek
   * lider tablosunu da "0 puanlı" kayıtlarla doldururdu.
   */
  findRound(userId: string, puzzleDay: number): Promise<StoredRound | null>;

  /**
   * Cevabı yazar; tur yoksa açar — BR-43, BR-44.
   *
   * TEK İŞLEMDE: cevap satırı, turun puan toplamı ve tamamlanma damgası
   * birlikte yazılır. Ayrı yazılsalardı araya giren bir hata `points`
   * alanını cevaplarla tutarsız bırakırdı ve tablo sessizce yanlış sıralardı.
   *
   * `complete` çağıran tarafından belirlenir: "tur bitti mi" kararı saf
   * kuraldır (`isRoundFinished`), veritabanının işi değil.
   */
  saveAnswer(input: {
    readonly userId: string;
    readonly puzzleDay: number;
    readonly answer: RoundAnswer;
    readonly complete: boolean;
  }): Promise<SaveAnswerResult>;

  /**
   * Lider tablosu için TAMAMLANMIŞ turlar — BR-45, BR-50.
   *
   * `range` yoksa tüm zamanlar. Yarım turlar sorguya HİÇ girmez: filtreyi
   * çağırana bırakmak, bir gün birinin unutmasıyla yarım turların tabloya
   * sızması demekti.
   */
  findCompletedRounds(
    range: {
      readonly from: number;
      readonly to: number;
    } | null,
  ): Promise<readonly CompletedRound[]>;

  /**
   * Bir görünen adı bildirir — BR-53, §11.12.
   *
   * "zaten-bildirdi" BİR HATA DEĞİL: kural "bir kullanıcı bir hedefi bir kez
   * bildirir" diyor ve ikinci deneme o kuralın beklenen sonucudur. Çağıran
   * bunu kullanıcıya "bildirimin alındı" diye çevirir — ikisini ayırt
   * ettirmek, kimin daha önce bildirdiğini sızdırırdı.
   *
   * KENDİ ADINI BİLDİRME denetimi burada DEĞİL: o bir kural kararıdır ve
   * çağıranda duruyor. Port yalnızca depolamayı tarif eder.
   */
  saveNameReport(input: {
    readonly reporterId: string;
    readonly reportedId: string;
    readonly reason: ReportReason;
  }): Promise<SaveReportResult>;
}
