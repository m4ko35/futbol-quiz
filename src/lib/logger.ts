/**
 * Sunucu tarafı loglama — PROJECT.md §6.3, §7.8.
 *
 * Kural: ayrıntı LOGA, kimlik YANITA. Yığın izi, SQL parçası ve dosya yolu
 * yalnızca burada görünür; kullanıcı bunların hiçbirini görmez.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  readonly traceId?: string;
  readonly route?: string;
  readonly status?: number;
  readonly durationMs?: number;
  readonly code?: string;
  readonly [key: string]: unknown;
}

/**
 * Bilinmeyen bir fırlatılmış değeri loglanabilir hâle getirir.
 *
 * `catch` bloğuna gelen şeyin `Error` olduğu GARANTİ DEĞİLDİR — JavaScript'te
 * her değer fırlatılabilir. Doğrudan `error.message` okumak, bir dizenin
 * fırlatıldığı durumda log satırını da çökertirdi.
 */
export function describeError(error: unknown): {
  name: string;
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack === undefined ? {} : { stack: error.stack }),
    };
  }
  return { name: "UnknownThrown", message: String(error) };
}

/**
 * Tek satırlık JSON log.
 *
 * Neden JSON: satırlar bir gün bir toplayıcıya (log aggregator) akacak ve
 * `traceId` ile aranabilir olmaları gerekiyor. Serbest metin bu aramayı
 * kırılgan kılardı.
 */
export function log(level: LogLevel, message: string, fields: LogFields = {}) {
  const line = JSON.stringify({
    level,
    message,
    at: new Date().toISOString(),
    ...fields,
  });

  // Uyarı ve hatalar stderr'e; altyapıların çoğu iki akımı ayrı toplar.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
