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
