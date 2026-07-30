import { describe, expect, it } from "vitest";
import {
  ClubNotFoundError,
  DomainError,
  InvalidIdentifierError,
  SameClubError,
  ValidationError,
} from "@/domain/errors/domain-error";
import { rateLimitedError, toApiError } from "@/lib/http/api-error";

/** §6.3 — hata biçimi ve sızıntı yasağı. */

const TRACE = "TRACE0123456789A";

describe("toApiError — domain hataları", () => {
  it.each([
    [new ValidationError("Geçersiz."), 400, "VALIDATION_ERROR"],
    [new SameClubError(), 400, "VALIDATION_ERROR"],
    [new InvalidIdentifierError("kulüp", "!!"), 400, "VALIDATION_ERROR"],
    [new ClubNotFoundError(), 404, "NOT_FOUND"],
  ] as const)("%s → %i %s", (error, status, code) => {
    const mapped = toApiError(error, TRACE);

    expect(mapped.status).toBe(status);
    expect(mapped.body.error.code).toBe(code);
    expect(mapped.body.error.traceId).toBe(TRACE);
  });

  it("iç kod adlarını dışarı sızdırmaz", () => {
    // `SAME_CLUB` bir iç kod; §6.3 sözleşmesinde yok. Dışarıya çıkması hem
    // sözleşmeyi genişletir hem de kural yapısını açık eder.
    const mapped = toApiError(new SameClubError(), TRACE);

    expect(mapped.body.error.code).not.toBe("SAME_CLUB");
  });

  it("domain mesajını kullanıcıya gösterir", () => {
    const mapped = toApiError(new SameClubError(), TRACE);

    expect(mapped.body.error.message).toBe("İki farklı kulüp seçilmelidir.");
  });
});

describe("toApiError — beklenmeyen hatalar", () => {
  it("500 döner ve istisna mesajını GİZLER", () => {
    const secret = new Error(
      "SQLITE_ERROR: no such column: clubs.secret_column",
    );
    const mapped = toApiError(secret, TRACE);

    expect(mapped.status).toBe(500);
    expect(mapped.body.error.code).toBe("INTERNAL_ERROR");
    expect(mapped.body.error.message).toBe("Beklenmeyen bir hata oluştu.");
  });

  it("gövdenin hiçbir yerinde yığın izi, SQL veya dosya yolu yoktur", () => {
    const error = new Error("SELECT * FROM spells WHERE clubId = ?");
    error.stack =
      "Error: at C:/Users/mehme/Desktop/futbol-quiz/src/secret.ts:42";

    const serialized = JSON.stringify(toApiError(error, TRACE).body);

    expect(serialized).not.toMatch(/SELECT|FROM|SQLITE/iu);
    expect(serialized).not.toMatch(/\.ts|\\|\/Users\/|at /u);
  });

  it("ayrıntıyı log için AYRI alanda taşır", () => {
    // Ayrıntı kaybolmamalı — yalnızca yanıttan ayrılmalı.
    const error = new Error("gizli ayrıntı");
    const mapped = toApiError(error, TRACE);

    expect(mapped.internal).toBe(error);
  });

  it.each([
    ["dize", "çıplak dize fırlatıldı"],
    ["sayı", 42],
    ["null", null],
    ["nesne", { a: 1 }],
  ])("Error olmayan değer (%s) çökmeye yol açmaz", (_label, thrown) => {
    const mapped = toApiError(thrown, TRACE);

    expect(mapped.status).toBe(500);
    expect(mapped.body.error.message).toBe("Beklenmeyen bir hata oluştu.");
  });

  it("eşlenmemiş domain hatası 500'e düşer, mesajı gösterilmez", () => {
    // Yeni bir hata sınıfı eklenip eşleme tablosuna yazılmazsa güvenli tarafta
    // kalmalıyız: mesajın gözden kaçıp sızmasındansa 500 dönmek yeğdir.
    class UnmappedError extends DomainError {
      readonly code = "BRAND_NEW_CODE";
      constructor() {
        super("eşlenmemiş iç ayrıntı");
      }
    }

    const mapped = toApiError(new UnmappedError(), TRACE);

    expect(mapped.status).toBe(500);
    expect(mapped.body.error.message).toBe("Beklenmeyen bir hata oluştu.");
    expect(JSON.stringify(mapped.body)).not.toContain("eşlenmemiş");
  });
});

describe("rateLimitedError", () => {
  it("429 ve Retry-After başlığı üretir", () => {
    const mapped = rateLimitedError(TRACE, 37);

    expect(mapped.status).toBe(429);
    expect(mapped.body.error.code).toBe("RATE_LIMITED");
    expect(mapped.headers?.["Retry-After"]).toBe("37");
  });
});
