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
