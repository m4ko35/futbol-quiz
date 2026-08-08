/**
 * Tüm iş kuralı hatalarının ortak atası (PROJECT.md §6.3).
 *
 * Neden ayrı bir hiyerarşi? Sunum katmanının "beklenen bir kural ihlali" ile
 * "beklenmeyen bir çökme"yi ayırt edebilmesi gerekir: ilkinin mesajı kullanıcıya
 * gösterilebilir, ikincisi asla gösterilmez — çünkü yığın izi, dosya yolu veya
 * SQL parçası sızdırabilir.
 */
export abstract class DomainError extends Error {
  /** Makine tarafından okunan sabit kod. API yanıtındaki `error.code` budur. */
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    // Alt sınıfın adı; loglarda hangi hata olduğunu görebilmek için.
    this.name = new.target.name;
  }
}

/** BR-6: sezon yılına çevrilemeyen bir tarih verildi. */
export class InvalidSeasonDateError extends DomainError {
  readonly code = "INVALID_SEASON_DATE";

  constructor(reason: string) {
    super(`Geçersiz sezon tarihi: ${reason}`);
  }
}

/**
 * Biçimi kabul edilemeyen bir kimlik verildi.
 *
 * Ham değer mesaja KIRPILARAK girer. Gerekçe: bu mesaj `VALIDATION_ERROR`
 * olarak kullanıcıya dönebilir ve sınırsız uzunlukta bir girdiyi yanıta
 * yansıtmak hem log şişirme hem de yansıtmalı (reflected) içerik riskidir.
 */
export class InvalidIdentifierError extends DomainError {
  readonly code = "INVALID_IDENTIFIER";

  constructor(kind: string, raw: string) {
    const shown = raw.length > 16 ? `${raw.slice(0, 16)}…` : raw;
    super(`Geçersiz ${kind} kimliği: ${JSON.stringify(shown)}`);
  }
}

/**
 * Girdi sözleşmeye uymuyor (§6.3 → HTTP 400).
 *
 * Mesaj kullanıcıya gösterilebilir olmalıdır; bu yüzden alan adı ve beklenen
 * biçim dışında bir şey içermez. Ayrıştırıcının ham hata metni (yol, tip
 * ayrıntısı, gelen değer) buraya KONMAZ — yalnızca sunucu loguna yazılır.
 */
export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
  }
}

/** BR-4: aynı kulüp iki kez seçilemez. */
export class SameClubError extends DomainError {
  readonly code = "SAME_CLUB";

  constructor() {
    super("İki farklı kulüp seçilmelidir.");
  }
}

/**
 * İstenen kulüp veri kümesinde yok.
 *
 * Kimliği mesaja koymuyoruz: kullanıcıya bir şey ifade etmez ve var
 * olan/olmayan kimlikleri ayırt etmeyi kolaylaştırır (numaralandırma).
 */
export class ClubNotFoundError extends DomainError {
  readonly code = "NOT_FOUND";

  constructor() {
    super("Seçilen kulüp bulunamadı.");
  }
}

/**
 * Günün ızgarası üretilemedi (§9.1).
 *
 * Bu bir kullanıcı hatası DEĞİL, sunucu tarafı bir başarısızlıktır: üretim
 * ölçülen koşullarda 365/365 başarılı. Buraya düşülüyorsa havuz bozulmuş ya
 * da veri kümesi beklenmedik biçimde daralmıştır — sessizce boş bir ızgara
 * göstermek yerine hata vermek doğrudur (§2.7).
 */
export class GridUnavailableError extends DomainError {
  readonly code = "GRID_UNAVAILABLE";

  constructor() {
    super("Bugünün ızgarası hazırlanamadı.");
  }
}

/**
 * Günün istatistik oyuncusu seçilemedi (§9.2).
 *
 * `GridUnavailableError` ile aynı sınıf hata: kullanıcı hatası DEĞİL, sunucu
 * tarafı bir başarısızlık. Buraya düşülüyorsa ya yeni alanlar hiç çekilmemiş
 * ya da BR-15'i sağlayan oyuncu kalmamıştır — ölçülen havuz ~2.060 kişi.
 */
export class StatMatchUnavailableError extends DomainError {
  readonly code = "STAT_MATCH_UNAVAILABLE";

  constructor() {
    super("Bugünün oyuncusu hazırlanamadı.");
  }
}

/**
 * "Hangisi daha" havuzu BOŞ (§9.3).
 *
 * `GridUnavailableError` ile aynı sınıf: kullanıcı hatası değil, sunucu tarafı
 * bir başarısızlık. Buraya yalnızca koşunun İLK oyuncusu bile bulunamadığında
 * düşülür — yani ilgili istatistik veri kümesinde hiç yoksa (`heightCm`
 * çekilmemiş gibi).
 *
 * KOŞU İÇİNDE HAVUZUN TÜKENMESİ BU DEĞİLDİR. Görülen oyuncular dışlandıkça
 * (BR-28) aday bitebilir; o beklenen bir sondur ve `pair: null` ile normal bir
 * yanıt olarak döner (§6.6). Onu da hataya çevirmek, oyunun normal akışını
 * §6.3'ün hata sözleşmesine sokardı.
 */
export class RoundUnavailableError extends DomainError {
  readonly code = "ROUND_UNAVAILABLE";

  constructor() {
    super("Bu istatistikte sunulabilecek yeni bir eşleşme kalmadı.");
  }
}
