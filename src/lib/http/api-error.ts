import { DomainError } from "@/domain/errors/domain-error";

/**
 * Hata yanıtı üretimi — PROJECT.md §6.3.
 *
 * TEK KURAL: `500` gövdesi asla istisna mesajı, yığın izi, SQL parçası veya
 * dosya yolu içermez. Bunlar yalnızca sunucu loguna `traceId` ile yazılır.
 * Bu dosya o kuralın uygulandığı yerdir; hata yanıtı üreten başka bir yol
 * olmamalıdır.
 */

/** §6.3 tablosundaki kodlar. Dışarıya BUNLARIN DIŞINDA bir kod çıkmaz. */
export type ApiErrorCode =
  "VALIDATION_ERROR" | "NOT_FOUND" | "RATE_LIMITED" | "INTERNAL_ERROR";

export interface ApiErrorBody {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly traceId: string;
  };
}

export interface MappedError {
  readonly status: number;
  readonly body: ApiErrorBody;
  /** Yanıta eklenecek ek başlıklar (ör. `Retry-After`). */
  readonly headers?: Readonly<Record<string, string>>;
  /** Log'a yazılacak, kullanıcıya GİTMEYEN ayrıntı. */
  readonly internal?: unknown;
}

/**
 * Domain hata kodu → HTTP durumu ve dışa dönük kod.
 *
 * İç kodlar (`SAME_CLUB`, `INVALID_IDENTIFIER`…) dışarı SIZMAZ: hepsi §6.3'teki
 * dört koddan birine daralır. İç kod adları uygulamanın kural yapısını açık
 * eder ve sözleşmeyi de gereksiz yere genişletirdi.
 */
const DOMAIN_ERROR_MAP: Readonly<
  Record<string, { status: number; code: ApiErrorCode }>
> = {
  VALIDATION_ERROR: { status: 400, code: "VALIDATION_ERROR" },
  INVALID_IDENTIFIER: { status: 400, code: "VALIDATION_ERROR" },
  INVALID_SEASON_DATE: { status: 400, code: "VALIDATION_ERROR" },
  SAME_CLUB: { status: 400, code: "VALIDATION_ERROR" },
  NOT_FOUND: { status: 404, code: "NOT_FOUND" },
};

const GENERIC_MESSAGE = "Beklenmeyen bir hata oluştu.";

export function toApiError(error: unknown, traceId: string): MappedError {
  if (error instanceof DomainError) {
    const mapped = DOMAIN_ERROR_MAP[error.code];

    if (mapped !== undefined) {
      // Domain hata mesajları tasarım gereği kullanıcıya gösterilebilir:
      // kural ihlalini anlatırlar, iç yapıyı değil (§6.3).
      return {
        status: mapped.status,
        body: { error: { code: mapped.code, message: error.message, traceId } },
      };
    }

    // Eşlenmemiş bir domain hatası: yeni bir hata sınıfı eklenmiş ama bu
    // tabloya yazılmamış. Mesajı GÖSTERMİYORUZ — güvenli tarafta kalıp 500
    // dönüyoruz. Eksiklik log'da görünür; sessizce 400 dönmek, gözden kaçan
    // bir mesajın kullanıcıya sızmasına yol açabilirdi.
    return {
      status: 500,
      body: {
        error: { code: "INTERNAL_ERROR", message: GENERIC_MESSAGE, traceId },
      },
      internal: `Eşlenmemiş DomainError kodu: ${error.code}`,
    };
  }

  return {
    status: 500,
    body: {
      error: { code: "INTERNAL_ERROR", message: GENERIC_MESSAGE, traceId },
    },
    internal: error,
  };
}

/**
 * §6.3 — hız sınırı aşımı.
 *
 * `Retry-After` başlığını burada üretiyoruz, çağıranda değil: başlık
 * sözleşmenin parçası ("429 + Retry-After") ve onu üreten yerden ayrılırsa
 * bir gün yalnızca gövde döndürülüp başlık unutulur.
 */
export function rateLimitedError(
  traceId: string,
  retryAfterSeconds: number,
): MappedError {
  return {
    status: 429,
    body: {
      error: {
        code: "RATE_LIMITED",
        message: "Çok fazla istek gönderildi. Lütfen biraz sonra deneyin.",
        traceId,
      },
    },
    headers: { "Retry-After": String(retryAfterSeconds) },
  };
}
